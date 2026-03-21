import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

// GET: Birim fiyatlari listele
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const poz = searchParams.get('poz')

    let query = supabase
      .from('birim_fiyatlar')
      .select('*')
      .eq('is_active', true)
      .order('poz_no', { ascending: true })

    if (poz) query = query.eq('poz_no', poz.toUpperCase())

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ fiyatlar: data || [], count: data?.length || 0 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Excel'den birim fiyat yukle
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadi' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(bytes)

    const fiyatlar: Array<{
      poz_no: string
      poz_tanimi: string
      poz_birim_fiyat_tarifesi: string
      marka_model: string
      birim: string
      birim_fiyat: number
    }> = []

    // "BİRİM FİYATLAR" sheeti veya ilk sheet
    let targetSheet = workbook.SheetNames.find(s =>
      s.toUpperCase().includes('FİYAT') || s.toUpperCase().includes('FIYAT') || s.toUpperCase().includes('BİRİM')
    ) || workbook.SheetNames[0]

    const sheet = workbook.Sheets[targetSheet]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown as unknown[][]

    if (!data || data.length < 2) {
      return NextResponse.json({ error: 'Excel verisi bulunamadi' }, { status: 400 })
    }

    // Header satirini bul: POZ NO veya SIRA NO olan satir
    let pozNoCol = -1
    let tanimiCol = -1
    let tarifeCol = -1
    let markaCol = -1
    let birimCol = -1
    let fiyatCol = -1
    let headerRow = -1

    for (let row = 0; row < Math.min(data.length, 20); row++) {
      const cells = data[row]
      if (!cells) continue
      for (let col = 0; col < cells.length; col++) {
        const val = String(cells[col] || '').toUpperCase().trim()
        if (val.includes('POZ') && val.includes('NO')) { pozNoCol = col; headerRow = row }
        if (val === 'POZ NO' || val === 'POZ NUMARASI') { pozNoCol = col; headerRow = row }
        if (val.includes('TANIMI') || val.includes('AÇIKLAMA') || val === 'POZ TANIMI') tanimiCol = col
        if (val.includes('TARİFE') || val.includes('TARIFE') || val.includes('BİRİM FİYAT TARİF')) tarifeCol = col
        if (val.includes('MARKA') || val.includes('MODEL')) markaCol = col
        if (val === 'BİRİM' || val === 'BIRIM') birimCol = col
        // Fiyat sutunu: "BİRİM FİYAT", "FİYAT", veya yil (2024, 2025, 2026...)
        if (val.includes('BİRİM FİYAT') || val.includes('BIRIM FIYAT') || val.includes('FİYAT') || val === 'FIYAT') {
          if (!val.match(/^BİRİM$/)) fiyatCol = col
        }
        // Yil sutunu fiyat olarak kullanilir (ornek: "2026")
        if (val.match(/^20\d{2}$/)) fiyatCol = col
      }
    }

    // Birim ve fiyat sutunu ayni olabilir - fiyat genelde son numeric sutun
    if (pozNoCol === -1 || headerRow === -1) {
      return NextResponse.json({ error: 'POZ NO sutunu bulunamadi' }, { status: 400 })
    }

    for (let row = headerRow + 1; row < data.length; row++) {
      const cells = data[row]
      if (!cells) continue

      const pozNo = String(cells[pozNoCol] || '').trim().toUpperCase()
      if (!pozNo || pozNo === '' || !pozNo.match(/^[A-Z]-?\d+/)) continue

      // Fiyat degerini parse et
      let fiyat = 0
      if (fiyatCol >= 0) {
        const rawFiyat = cells[fiyatCol]
        if (typeof rawFiyat === 'number') {
          fiyat = rawFiyat
        } else {
          const str = String(rawFiyat || '').replace(/[^\d.,]/g, '').replace(',', '.')
          fiyat = parseFloat(str) || 0
        }
      }

      // POZ no formatini normalize et (A01 -> A-01)
      const normalizedPoz = pozNo.includes('-') ? pozNo : pozNo.replace(/^([A-Z])(\d+)/, '$1-$2')

      fiyatlar.push({
        poz_no: normalizedPoz,
        poz_tanimi: tanimiCol >= 0 ? String(cells[tanimiCol] || '').trim() : '',
        poz_birim_fiyat_tarifesi: tarifeCol >= 0 ? String(cells[tarifeCol] || '').trim() : '',
        marka_model: markaCol >= 0 ? String(cells[markaCol] || '').trim() : '',
        birim: birimCol >= 0 ? String(cells[birimCol] || '').trim() : '',
        birim_fiyat: fiyat,
      })
    }

    if (fiyatlar.length === 0) {
      return NextResponse.json({ error: 'Excel dosyasinda POZ verisi bulunamadi' }, { status: 400 })
    }

    // Mevcut verileri sil ve yenilerini ekle
    const { error: deleteError } = await supabase
      .from('birim_fiyatlar')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) throw deleteError

    // Batch insert
    let inserted = 0
    const batchSize = 100
    for (let i = 0; i < fiyatlar.length; i += batchSize) {
      const batch = fiyatlar.slice(i, i + batchSize)
      const { error } = await supabase.from('birim_fiyatlar').insert(batch)
      if (error) throw error
      inserted += batch.length
    }

    return NextResponse.json({
      success: true,
      message: `${inserted} POZ birim fiyat yuklendi (Sheet: ${targetSheet})`,
      stats: { total: inserted, sheet: targetSheet },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
