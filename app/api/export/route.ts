import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findMagaza, findMagazaByKod } from '@/lib/reference-data'
import type { Tutanak } from '@/lib/supabase'

// Turkce normalize
function normalize(str: string): string {
  return str.toLowerCase().replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/İ/g, 'i').replace(/Ğ/g, 'g').replace(/Ü/g, 'u')
    .replace(/Ş/g, 's').replace(/Ö/g, 'o').replace(/Ç/g, 'c').trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

function findUygulamaciGroup(
  isim: string,
  groups: Array<{ group_name: string; members: string[] }>
): string {
  if (!isim) return ''
  const normIsim = normalize(isim)
  const isimParts = normIsim.split(/\s+/)
  const isimSoyad = isimParts[isimParts.length - 1]

  for (const group of groups) {
    for (const member of group.members) {
      if (normalize(member) === normIsim) return group.group_name
    }
  }

  for (const group of groups) {
    for (const member of group.members) {
      const memberParts = normalize(member).split(/\s+/)
      const memberSoyad = memberParts[memberParts.length - 1]
      if (isimSoyad === memberSoyad && isimSoyad.length > 2) return group.group_name
    }
  }

  let bestMatch = { group: '', score: 0 }
  for (const group of groups) {
    for (const member of group.members) {
      const normMember = normalize(member)
      const fullSim = similarity(normIsim, normMember)
      if (fullSim > bestMatch.score) bestMatch = { group: group.group_name, score: fullSim }
      const memberParts = normMember.split(/\s+/)
      const memberSoyad = memberParts[memberParts.length - 1]
      const soyadSim = similarity(isimSoyad, memberSoyad)
      if (soyadSim > bestMatch.score && isimSoyad.length > 2) bestMatch = { group: group.group_name, score: soyadSim }
    }
  }

  return bestMatch.score >= 0.8 ? bestMatch.group : isim
}

// Renkler - referans Excel ile birebir
const COLORS = {
  titleBg: 'DDD9C3',     // Row 1 bej
  headerBg: 'EEECE1',    // Header satiri acik bej
  white: 'FFFFFF',
}

// Thin border style
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

const headerFont: Partial<ExcelJS.Font> = { bold: true, size: 10, name: 'Calibri' }
const dataFont: Partial<ExcelJS.Font> = { size: 10, name: 'Calibri' }

function addHeaderRow(ws: ExcelJS.Worksheet, uygulamaci: string, bolge: string) {
  const row = ws.addRow([
    'NO', 'TARİH', 'ÇAĞ.NO', 'MAĞ.NO.', 'MAĞAZA İSMİ',
    'NO', 'POZ KODU', 'AÇIKLAMA', 'BİRİM\nMİKTARI', 'BİRİM\nFİYAT',
    'TOPLAM TUTAR', '', '', uygulamaci, bolge,
  ])
  row.height = 29
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber <= 11) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    }
    cell.font = headerFont
    cell.border = thinBorder
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
}

function addToplamRow(ws: ExcelJS.Worksheet, startRow: number, endRow: number, tutanakNo: string, uygulamaci: string, bolge: string, toplamDeger: number) {
  const row = ws.addRow([
    'TOPLAM', '', '', '', '',
    '', '', `TUTANAK NO:${tutanakNo}`, '', '',
    null, '', '', uygulamaci, bolge,
  ])
  // K hucresine formul + hesaplanmis deger
  const kCell = row.getCell(11)
  kCell.value = { formula: `SUM(K${startRow}:K${endRow})`, result: toplamDeger } as ExcelJS.CellFormulaValue
  row.height = 15.5
  // A-E merged
  ws.mergeCells(row.number, 1, row.number, 5)
  // F-G merged
  ws.mergeCells(row.number, 6, row.number, 7)

  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber <= 11 || colNumber === 13) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    }
    if (colNumber === 8) { // H = TUTANAK NO - kirmizi arkaplan
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0000' } }
      cell.font = { ...headerFont, bold: true, color: { argb: 'FFFFFF' } }
    } else {
      cell.font = { ...headerFont, bold: true }
    }
    if (colNumber === 11) { // K = TOPLAM TUTAR
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
      cell.numFmt = '#,##0.00 ₺'
    }
    cell.border = thinBorder
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 8 ? 'left' : 'center' }
  })
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const bolgeFilter = searchParams.get('bolge') || ''
    const yilFilter = searchParams.get('yil') || new Date().getFullYear().toString()

    // Tutanaklar + items
    let query = supabase
      .from('tutanaklar')
      .select('*, tutanak_items(*)')
      .order('tarih', { ascending: true })

    if (bolgeFilter) {
      query = query.ilike('bolge', `%${bolgeFilter}%`)
    }

    const { data, error } = await query
    if (error) throw error

    const tutanaklar = (data || []) as Tutanak[]

    // Uygulamaci gruplarini cek
    const { data: groupsData } = await supabase
      .from('uygulamaci_groups')
      .select('group_name, members')
      .eq('is_active', true)
    const uygulamaciGroups = groupsData || []

    // ExcelJS Workbook
    const wb = new ExcelJS.Workbook()
    const sheetName = bolgeFilter
      ? `${bolgeFilter.toUpperCase()} SERVİSLER-${yilFilter}`
      : `SERVİSLER-${yilFilter}`

    const ws = wb.addWorksheet(sheetName.substring(0, 31))

    // Sutun genislikleri (referans Excel ile ayni)
    ws.columns = [
      { key: 'A', width: 8.67 },    // A: NO
      { key: 'B', width: 12.17 },   // B: TARİH
      { key: 'C', width: 19 },      // C: ÇAĞ.NO
      { key: 'D', width: 12.67 },   // D: MAĞ.NO.
      { key: 'E', width: 39.67 },   // E: MAĞAZA İSMİ
      { key: 'F', width: 14.42 },   // F: NO
      { key: 'G', width: 15.17 },   // G: POZ KODU
      { key: 'H', width: 96.67 },   // H: AÇIKLAMA
      { key: 'I', width: 17.5 },    // I: BİRİM MİKTARI
      { key: 'J', width: 12.67 },   // J: BİRİM FİYAT
      { key: 'K', width: 17.5 },    // K: TOPLAM TUTAR
      { key: 'L', width: 3 },       // L: bos
      { key: 'M', width: 18.42 },   // M: MALİYET
      { key: 'N', width: 23.58 },   // N: UYGULAMACI
      { key: 'O', width: 23.58 },   // O: BÖLGE MÜDÜRLÜĞÜ
    ]

    // ROW 1: Baslik satiri
    const titleText = bolgeFilter
      ? `${bolgeFilter.toUpperCase()} SERVİSLER ÇALIŞMA SAYFASI`
      : `SERVİSLER ÇALIŞMA SAYFASI`

    const titleRow = ws.addRow([titleText, '', '', '', '', '', '', '', '', '', '', '', 'MALİYET', 'UYGULAMACI', 'BÖLGE MÜDÜRLÜĞÜ'])
    titleRow.height = 34.5
    ws.mergeCells('A1:K1')
    titleRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 11) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
      }
      cell.font = { bold: true, size: 12, name: 'Calibri' }
      cell.alignment = { vertical: 'middle', horizontal: colNumber <= 11 ? 'center' : 'center' }
      cell.border = thinBorder
    })

    // Her tutanak blogu
    let groupNo = 0

    for (const tutanak of tutanaklar) {
      const items = tutanak.tutanak_items || []
      if (items.length === 0) continue

      groupNo++

      // Magaza bilgisi
      const magazaMatch = tutanak.magaza_no
        ? findMagazaByKod(String(tutanak.magaza_no).trim()) || findMagaza(tutanak.magaza || '')
        : findMagaza(tutanak.magaza || '')

      const uygulamaci = findUygulamaciGroup(tutanak.firma_sorumlusu || '', uygulamaciGroups)
      const bolge = magazaMatch?.yeni_idari_bolge || tutanak.bolge || ''

      // Header satiri (her tutanak oncesi tekrarlanir)
      addHeaderRow(ws, uygulamaci, bolge)

      const sortedItems = [...items].sort((a, b) => a.sira_no - b.sira_no)
      const dataStartRow = ws.rowCount + 1

      // Veri satirlari
      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i]
        const isFirstRow = i === 0

        // Tarih formatlama: DB'den gelen formati direkt kullan
        let tarihStr = ''
        if (tutanak.tarih) {
          const t = tutanak.tarih
          // ISO format (2026-02-23) veya diger formatlari handle et
          if (t.includes('-')) {
            const parts = t.split('T')[0].split('-')
            if (parts.length === 3) {
              tarihStr = `${parts[2]}.${parts[1]}.${parts[0]}` // DD.MM.YYYY
            } else {
              tarihStr = t
            }
          } else {
            tarihStr = t
          }
        }

        const row = ws.addRow([
          isFirstRow ? groupNo : '',                       // A: NO
          isFirstRow ? tarihStr : '',                       // B: TARİH
          isFirstRow ? (tutanak.cagri_no || '') : '',       // C: ÇAĞ.NO
          isFirstRow ? (tutanak.magaza_no || '') : '',      // D: MAĞ.NO.
          isFirstRow ? (magazaMatch?.magaza_adi || tutanak.magaza || '') : '', // E: MAĞAZA İSMİ
          item.sira_no,                                     // F: NO
          item.poz_kodu || 'S-09',                          // G: POZ KODU
          item.aciklama || '',                               // H: AÇIKLAMA
          item.miktar || 0,                                 // I: BİRİM MİKTARI
          item.birim_fiyat || 0,                            // J: BİRİM FİYAT
          null,                                             // K: formul ile
          '',                                               // L: bos
          '',                                               // M: bos
          uygulamaci,                                       // N: UYGULAMACI
          bolge,                                            // O: BÖLGE MÜDÜRLÜĞÜ
        ])

        row.height = 15.5

        // K kolonu formul: =I*J + hesaplanmis deger
        const miktar = item.miktar || 0
        const birimFiyat = item.birim_fiyat || 0
        const kCell = row.getCell(11)
        kCell.value = { formula: `I${row.number}*J${row.number}`, result: miktar * birimFiyat } as ExcelJS.CellFormulaValue

        // Stiller
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = dataFont
          cell.border = thinBorder
          cell.alignment = { vertical: 'middle' }

          if (colNumber === 1) { // A kolonu bej arkaplan
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.titleBg } }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.white } }
          }

          // Hizalama
          if ([1, 4, 6].includes(colNumber)) cell.alignment = { vertical: 'middle', horizontal: 'center' }
          if (colNumber === 9 || colNumber === 10 || colNumber === 11) {
            cell.numFmt = '#,##0.00'
            cell.alignment = { vertical: 'middle', horizontal: 'right' }
          }
        })
      }

      const dataEndRow = ws.rowCount

      // Toplam degeri hesapla
      const toplamDeger = sortedItems.reduce((sum, item) => sum + (item.miktar || 0) * (item.birim_fiyat || 0), 0)

      // TOPLAM satiri
      addToplamRow(ws, dataStartRow, dataEndRow, tutanak.no || '', uygulamaci, bolge, toplamDeger)
    }

    // AutoFilter - Row 2'den (ilk header) baslayarak
    if (ws.rowCount > 2) {
      ws.autoFilter = {
        from: { row: 2, column: 1 },
        to: { row: ws.rowCount, column: 15 },
      }
    }

    // Buffer olustur
    const buffer = await wb.xlsx.writeBuffer()

    const fileName = bolgeFilter
      ? `${bolgeFilter.toUpperCase()}_servisler_${yilFilter}.xlsx`
      : `servisler_${yilFilter}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    console.error('Export hatasi:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
