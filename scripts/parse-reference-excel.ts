import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================
// BIRIM FIYATLAR PARSE
// ============================================================
function parseBirimFiyatlar(filePath: string): void {
  console.log('Birim Fiyatlar parse ediliyor:', filePath)
  const wb = XLSX.readFile(filePath)

  // "BİRİM FİYATLAR" sayfasini bul
  const sheetName = wb.SheetNames.find(s =>
    s.toUpperCase().includes('BİRİM FİYAT') ||
    s.toUpperCase().includes('BIRIM FIYAT')
  )

  if (!sheetName) {
    console.error('BİRİM FİYATLAR sayfasi bulunamadi. Mevcut sayfalar:', wb.SheetNames)
    return
  }

  console.log('Sayfa bulundu:', sheetName)
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 })

  // Header satirini bul (POZ NO iceren satir)
  let headerIdx = 0
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] as unknown[]
    if (row && row.some(cell => String(cell || '').toUpperCase().includes('POZ'))) {
      headerIdx = i
      break
    }
  }

  const result: Array<{
    poz_no: string
    poz_tanimi: string
    poz_birim_fiyat_tarifesi: string
    marka_model: string
    birim: string
    birim_fiyat: number
  }> = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || !row[0]) continue

    const pozNo = String(row[0] || '').trim()
    if (!pozNo) continue

    result.push({
      poz_no: pozNo,
      poz_tanimi: String(row[1] || '').trim(),
      poz_birim_fiyat_tarifesi: String(row[2] || '').trim(),
      marka_model: String(row[3] || '').trim(),
      birim: String(row[4] || '').trim(),
      birim_fiyat: parseFloat(String(row[5] || '0')) || 0,
    })
  }

  const outPath = path.join(__dirname, '..', 'data', 'birim-fiyatlar.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`${result.length} birim fiyat kaydi yazildi: ${outPath}`)
}

// ============================================================
// MAGAZALAR PARSE
// ============================================================
function parseMagazalar(filePath: string): void {
  console.log('Magazalar parse ediliyor:', filePath)
  const wb = XLSX.readFile(filePath)

  // "MAĞAZALAR" sayfasini bul
  const sheetName = wb.SheetNames.find(s =>
    s.toUpperCase().includes('MAĞAZA') ||
    s.toUpperCase().includes('MAGAZA')
  )

  if (!sheetName) {
    console.error('MAĞAZALAR sayfasi bulunamadi. Mevcut sayfalar:', wb.SheetNames)
    return
  }

  console.log('Sayfa bulundu:', sheetName)
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 })

  // Header satirini bul
  let headerIdx = 0
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] as unknown[]
    if (row && row.some(cell => String(cell || '').toUpperCase().includes('KOD'))) {
      headerIdx = i
      break
    }
  }

  const result: Array<{
    kod: string
    magaza_adi: string
    yeni_idari_bolge: string
    yeni_bolge_muduru: string
    yeni_bolge_yoneticisi: string
  }> = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || !row[0]) continue

    const kod = String(row[0] || '').trim()
    if (!kod) continue

    // Kolon sırası: A=KOD, B=MAĞAZA ADI, C=DİREKTÖRLÜK, D=YENİ DİREKTÖRLÜK,
    // E=(bos/formul), F=İDARİ BÖLGE, G=YENİ İDARİ BÖLGE,
    // H=(bos/formul), I=BÖLGE MÜDÜRÜ, J=YENİ BÖLGE MÜDÜRÜ,
    // K=(bos/formul), L=BÖLGE YÖNETİCİSİ, M=YENİ BÖLGE YÖNETİCİSİ
    result.push({
      kod: kod,
      magaza_adi: String(row[1] || '').trim(),
      yeni_idari_bolge: String(row[6] || row[5] || '').trim(),
      yeni_bolge_muduru: String(row[9] || row[8] || '').trim(),
      yeni_bolge_yoneticisi: String(row[12] || row[11] || '').trim(),
    })
  }

  const outPath = path.join(__dirname, '..', 'data', 'magazalar.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`${result.length} magaza kaydi yazildi: ${outPath}`)
}

// ============================================================
// MAIN
// ============================================================
const args = process.argv.slice(2)

if (args.length === 0) {
  // Default dosya yollari
  const birimFiyatlarFile = path.join(
    '/Users/burakgolgeli/Downloads',
    'ADANA 16-28 ŞUBAT 2026 SERVİSLER ÇALIŞMA SAYFASI.xlsx'
  )
  const magazalarFile = path.join(
    '/Users/burakgolgeli/Downloads',
    'BÖLGE KIRILIMI SON LİSTE1 (1).xlsx'
  )

  if (fs.existsSync(birimFiyatlarFile)) {
    parseBirimFiyatlar(birimFiyatlarFile)
  } else {
    console.error('Birim fiyatlar dosyasi bulunamadi:', birimFiyatlarFile)
  }

  if (fs.existsSync(magazalarFile)) {
    parseMagazalar(magazalarFile)
  } else {
    console.error('Magazalar dosyasi bulunamadi:', magazalarFile)
  }
} else {
  // Manuel dosya yolu
  for (const filePath of args) {
    if (!fs.existsSync(filePath)) {
      console.error('Dosya bulunamadi:', filePath)
      continue
    }
    const wb = XLSX.readFile(filePath)
    const hasbirim = wb.SheetNames.some(s =>
      s.toUpperCase().includes('BİRİM FİYAT') || s.toUpperCase().includes('BIRIM FIYAT')
    )
    const hasMagaza = wb.SheetNames.some(s =>
      s.toUpperCase().includes('MAĞAZA') || s.toUpperCase().includes('MAGAZA')
    )

    if (hasbirim) parseBirimFiyatlar(filePath)
    if (hasMagaza) parseMagazalar(filePath)
  }
}
