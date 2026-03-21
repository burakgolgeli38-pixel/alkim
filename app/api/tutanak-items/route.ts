import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findPozKodu } from '@/lib/reference-data'

// Yeni is kalemi ekle
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()

    const pozRef = findPozKodu(body.poz_kodu || 'S-09')
    const pozKodu = pozRef ? body.poz_kodu : 'S-09'
    const finalPoz = findPozKodu(pozKodu)
    const birimFiyat = finalPoz?.birim_fiyat || 0
    const miktar = body.miktar || 1

    const { data, error } = await supabase
      .from('tutanak_items')
      .insert({
        tutanak_id: body.tutanak_id,
        sira_no: body.sira_no || 1,
        aciklama: body.aciklama || '',
        miktar,
        birim: body.birim || finalPoz?.birim || 'Adet',
        poz_kodu: pozKodu,
        poz_aciklama: finalPoz?.poz_tanimi || '',
        birim_fiyat: birimFiyat,
        toplam_tutar: miktar * birimFiyat,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Is kalemi guncelle
export async function PUT(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()

    if (!body.id) {
      return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
    }

    // POZ kodu degistiyse birim fiyati guncelle
    const updateData: Record<string, unknown> = {}

    if (body.poz_kodu !== undefined) {
      const pozRef = findPozKodu(body.poz_kodu)
      const pozKodu = pozRef ? body.poz_kodu : 'S-09'
      const finalPoz = findPozKodu(pozKodu)
      updateData.poz_kodu = pozKodu
      updateData.poz_aciklama = finalPoz?.poz_tanimi || ''
      updateData.birim_fiyat = finalPoz?.birim_fiyat || 0
      updateData.birim = body.birim || finalPoz?.birim || 'Adet'
    }

    if (body.aciklama !== undefined) updateData.aciklama = body.aciklama
    if (body.miktar !== undefined) updateData.miktar = body.miktar
    if (body.birim !== undefined) updateData.birim = body.birim

    // toplam_tutar hesapla
    const miktar = body.miktar ?? (updateData.miktar as number)
    const birimFiyat = updateData.birim_fiyat as number | undefined

    if (miktar !== undefined && birimFiyat !== undefined) {
      updateData.toplam_tutar = miktar * birimFiyat
    } else if (miktar !== undefined) {
      // Mevcut birim fiyati al
      const { data: current } = await supabase
        .from('tutanak_items')
        .select('birim_fiyat')
        .eq('id', body.id)
        .single()
      if (current) {
        updateData.toplam_tutar = miktar * current.birim_fiyat
      }
    }

    const { data, error } = await supabase
      .from('tutanak_items')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Is kalemi sil
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
    }

    const { error } = await supabase
      .from('tutanak_items')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
