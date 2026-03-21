import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

// GET: Magazalari listele
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const kod = searchParams.get('kod')
    const bolge = searchParams.get('bolge')

    let query = supabase
      .from('magazalar')
      .select('*')
      .eq('is_active', true)
      .order('kod', { ascending: true })

    if (kod) query = query.eq('kod', kod)
    if (bolge) query = query.ilike('idari_bolge', `%${bolge}%`)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ magazalar: data || [], count: data?.length || 0 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Excel'den magaza verisi yukle (toplu import)
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

    const magazalar: Array<{
      kod: string
      magaza_adi: string
      idari_bolge: string
      idari_isler_sorumlusu: string
    }> = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown as unknown[][]

      if (!data || data.length < 2) continue

      // Header satirini bul
      let kodCol = -1
      let adiCol = -1
      let bolgeCol = -1
      let sorumluCol = -1
      let headerRow = -1

      for (let row = 0; row < Math.min(data.length, 10); row++) {
        const cells = data[row]
        if (!cells) continue
        for (let col = 0; col < cells.length; col++) {
          const val = String(cells[col] || '').toUpperCase().trim()
          // KOD sutunu
          if (val === 'KOD') { kodCol = col; headerRow = row }
          // MAGAZA ADI
          if (val.includes('MA\u011EAZA') && val.includes('AD')) adiCol = col
          if (val === 'MA\u011EAZA ADI' || val === 'MAGAZA ADI') adiCol = col
          // IDARI BOLGE
          if (val.includes('\u0130DAR\u0130') && val.includes('B\u00D6LGE')) bolgeCol = col
          if (val === '\u0130DAR\u0130 B\u00D6LGE' || val === 'IDARI BOLGE') bolgeCol = col
          // IDARI ISLER SORUMLUSU
          if (val.includes('\u0130DAR\u0130') && val.includes('SORUMLU')) sorumluCol = col
          if (val.includes('IDARI') && val.includes('SORUMLU')) sorumluCol = col
        }
      }

      if (kodCol === -1 || headerRow === -1) continue

      for (let row = headerRow + 1; row < data.length; row++) {
        const cells = data[row]
        if (!cells) continue

        const kod = String(cells[kodCol] || '').trim()
        if (!kod || kod === '' || isNaN(Number(kod))) continue

        magazalar.push({
          kod,
          magaza_adi: adiCol >= 0 ? String(cells[adiCol] || '').trim() : '',
          idari_bolge: bolgeCol >= 0 ? String(cells[bolgeCol] || '').trim() : '',
          idari_isler_sorumlusu: sorumluCol >= 0 ? String(cells[sorumluCol] || '').trim() : '',
        })
      }
    }

    if (magazalar.length === 0) {
      return NextResponse.json({ error: 'Excel dosyasinda magaza verisi bulunamadi. KOD sutunu bulunamadi.' }, { status: 400 })
    }

    // Mevcut verileri sil ve yenilerini ekle (full replace)
    const { error: deleteError } = await supabase
      .from('magazalar')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (deleteError) throw deleteError

    // Batch insert (100'erli)
    let inserted = 0
    const batchSize = 100
    for (let i = 0; i < magazalar.length; i += batchSize) {
      const batch = magazalar.slice(i, i + batchSize)
      const { error } = await supabase.from('magazalar').insert(batch)
      if (error) throw error
      inserted += batch.length
    }

    return NextResponse.json({
      success: true,
      message: `${inserted} magaza yuklendi`,
      stats: { total: inserted },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
