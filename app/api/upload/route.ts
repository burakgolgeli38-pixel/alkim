import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findMagazaAsync, findMagazaByKodAsync, findPozKoduAsync, findSimilarMagazaKodlariAsync } from '@/lib/reference-data'
import { matchPozKodu, getPozDetailsAsync } from '@/lib/poz-matcher'
import { runOCR, correctOCRText } from '@/lib/ocr-engine'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY env variable bulunamadı' }, { status: 500 })
    }
    const anthropic = new Anthropic({ apiKey })
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

    // ═══════════════════════════════════════
    // ADIM 1: 2-Pass OCR + Post-OCR Düzeltme
    // ═══════════════════════════════════════
    const ocrResult = await runOCR(anthropic, base64, mediaType)
    const extracted = ocrResult.extracted

    console.log(`[OCR] ${ocrResult.passes_used} geçiş kullanıldı, genel güven: ${(ocrResult.confidence.overall * 100).toFixed(0)}%`)
    if (ocrResult.corrections.length > 0) {
      console.log(`[OCR] Düzeltmeler: ${ocrResult.corrections.join(', ')}`)
    }
    if (ocrResult.confidence.low_confidence_fields.length > 0) {
      console.log(`[OCR] Düşük güvenli alanlar: ${ocrResult.confidence.low_confidence_fields.join(', ')}`)
    }

    // ═══════════════════════════════════════
    // ADIM 2: Görseli Supabase Storage'a yükle
    // ═══════════════════════════════════════
    const supabaseAdmin = getSupabaseAdmin()
    const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
    const fileName = `tutanak_${Date.now()}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('tutanaklar')
      .upload(fileName, buffer, { contentType: file.type })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('tutanaklar')
      .getPublicUrl(fileName)

    // ═══════════════════════════════════════
    // ADIM 3: Mağaza Kodu Eşleştirme (çok katmanlı)
    // ═══════════════════════════════════════
    let magazaMatch = null
    let ocrMagazaNo = String(extracted.magaza_no || '').trim()
    const ocrMagaza = String(extracted.magaza || '').trim()

    // Mağaza alanında gizli kod varsa çıkar (örn: "1064 GÖLBAŞI")
    if (!ocrMagazaNo && ocrMagaza) {
      const kodMatch = ocrMagaza.match(/\b(\d{3,5})\b/)
      if (kodMatch) {
        ocrMagazaNo = kodMatch[1]
      }
    }

    // Katman 1: Tam eşleşme (kod ile)
    if (ocrMagazaNo) {
      magazaMatch = await findMagazaByKodAsync(ocrMagazaNo)
    }

    // Katman 2: İsim ile fuzzy arama
    if (!magazaMatch && ocrMagaza) {
      magazaMatch = await findMagazaAsync(ocrMagaza)
    }

    // Katman 3: Kod bulunamadıysa benzer kodları öner
    let similarKodlar: Array<{ kod: string; magaza_adi: string; bolge: string }> = []
    if (ocrMagazaNo && !magazaMatch) {
      similarKodlar = await findSimilarMagazaKodlariAsync(ocrMagazaNo)
    }

    // ═══════════════════════════════════════
    // ADIM 4: Doğrulama ve Uyarılar
    // ═══════════════════════════════════════
    const uyarilar: string[] = []

    if (ocrMagazaNo && !magazaMatch) {
      let msg = `Mağaza kodu "${ocrMagazaNo}" referans veride bulunamadı`
      if (similarKodlar.length > 0) {
        const suggestions = similarKodlar.map(s => `${s.kod} (${s.magaza_adi})`).join(', ')
        msg += `. Benzer kodlar: ${suggestions}`
      }
      uyarilar.push(msg)
    }
    if (!ocrMagazaNo && !ocrMagaza) {
      uyarilar.push('Mağaza kodu ve ismi okunamadı')
    }

    // OCR güven uyarıları
    if (ocrResult.confidence.overall < 0.6) {
      uyarilar.push(`OCR güven skoru düşük: %${(ocrResult.confidence.overall * 100).toFixed(0)} — form tekrar kontrol edilmeli`)
    }
    for (const field of ocrResult.confidence.low_confidence_fields) {
      if (field === 'magaza_no') {
        uyarilar.push(`Mağaza kodu okuma güveni düşük: %${((ocrResult.confidence.fields.magaza_no || 0) * 100).toFixed(0)}`)
      }
    }

    // OCR düzeltme uyarıları
    if (ocrResult.corrections.length > 0) {
      uyarilar.push(`OCR düzeltmeleri: ${ocrResult.corrections.join('; ')}`)
    }

    const dogrulamaDurumu = uyarilar.some(u =>
      u.includes('bulunamadı') || u.includes('okunamadı') || u.includes('düşük')
    ) ? 'uyari' : 'ok'

    // Mağaza ve bölge bilgisi
    const fullMagazaAdi = magazaMatch?.magaza_adi || ocrMagaza || ''
    const magazaNo = magazaMatch?.kod || ocrMagazaNo || ''
    // Bölge SADECE referans veriden
    const bolgeBilgisi = magazaMatch?.yeni_idari_bolge || ''

    if (!magazaMatch?.yeni_idari_bolge && ocrMagazaNo) {
      uyarilar.push(`Mağaza kodu "${ocrMagazaNo}" için bölge bilgisi bulunamadı`)
    }

    // ═══════════════════════════════════════
    // ADIM 5: Tutanak Header Kaydet
    // ═══════════════════════════════════════
    const { data: tutanakData, error: tutanakError } = await supabaseAdmin
      .from('tutanaklar')
      .insert({
        no: extracted.no || '',
        tarih: extracted.tarih || '',
        mudahale_tarihi: extracted.mudahale_tarihi || '',
        bolge: bolgeBilgisi,
        magaza: fullMagazaAdi,
        magaza_no: magazaNo,
        adres: extracted.adres || '',
        cagri_no: extracted.cagri_no || '',
        konu: extracted.konu || '',
        aciklama: extracted.isler?.map(i => i.aciklama).join('; ') || '',
        firma_sorumlusu: extracted.firma_sorumlusu || '',
        sorumlu: extracted.sorumlu || '',
        gorsel_url: publicUrl,
        dogrulama_durumu: dogrulamaDurumu,
        dogrulama_notlari: uyarilar.join(' | '),
      })
      .select()
      .single()

    if (tutanakError) throw tutanakError

    // ═══════════════════════════════════════
    // ADIM 6: POZ Eşleştirme + Fiyatlandırma
    // ═══════════════════════════════════════
    const isler = extracted.isler || []
    const items = []
    for (let idx = 0; idx < isler.length; idx++) {
      const is_kalemi = isler[idx]
      let aciklama = is_kalemi.aciklama || ''

      // Post-OCR düzeltme (iş açıklaması bazında)
      const { corrected } = correctOCRText(aciklama)
      aciklama = corrected

      const pozKodu = await matchPozKodu(aciklama)
      const pozDetails = await getPozDetailsAsync(pozKodu)
      const miktar = is_kalemi.miktar || 1
      const birimFiyat = pozDetails.birim_fiyat

      items.push({
        tutanak_id: tutanakData.id,
        sira_no: idx + 1,
        aciklama: aciklama,
        miktar: miktar,
        birim: is_kalemi.birim || pozDetails.birim || 'Adet',
        poz_kodu: pozDetails.poz_kodu,
        poz_aciklama: pozDetails.poz_aciklama,
        birim_fiyat: birimFiyat,
        toplam_tutar: miktar * birimFiyat,
      })
    }

    // S-07 ve S-08 otomatik ekle
    const s07 = await findPozKoduAsync('S-07')
    const s08 = await findPozKoduAsync('S-08')
    const maxSira = items.length

    items.push({
      tutanak_id: tutanakData.id,
      sira_no: maxSira + 1,
      aciklama: 'SERVİS BEDELİ',
      miktar: 1,
      birim: 'Adet',
      poz_kodu: 'S-07',
      poz_aciklama: s07?.poz_tanimi || 'SERVİS BEDELİ',
      birim_fiyat: s07?.birim_fiyat || 550.65,
      toplam_tutar: s07?.birim_fiyat || 550.65,
    })

    items.push({
      tutanak_id: tutanakData.id,
      sira_no: maxSira + 2,
      aciklama: 'SERVİS YOL ÜCRETİ',
      miktar: 0,
      birim: 'km',
      poz_kodu: 'S-08',
      poz_aciklama: s08?.poz_tanimi || 'TEK YÖNDE 60 KM ÜZERİ SERVİS YOL ÜCRETİ',
      birim_fiyat: s08?.birim_fiyat || 8.66,
      toplam_tutar: 0,
    })

    if (items.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from('tutanak_items')
        .insert(items)
      if (itemsError) throw itemsError
    }

    // ═══════════════════════════════════════
    // ADIM 7: Response
    // ═══════════════════════════════════════
    return NextResponse.json({
      success: true,
      dogrulama_durumu: dogrulamaDurumu,
      uyarilar: uyarilar,
      ocr_meta: {
        passes_used: ocrResult.passes_used,
        overall_confidence: Math.round(ocrResult.confidence.overall * 100),
        low_confidence_fields: ocrResult.confidence.low_confidence_fields,
        corrections: ocrResult.corrections,
        similar_magaza_kodlari: similarKodlar,
      },
      tutanak: {
        ...tutanakData,
        tutanak_items: items,
        uygulamaci: magazaMatch?.idari_isler_sorumlusu || '',
        bolge_mudurlugu: magazaMatch?.yeni_idari_bolge || '',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    console.error('Upload hatası:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
