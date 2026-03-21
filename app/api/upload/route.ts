import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findMagazaAsync, findMagazaByKodAsync, findPozKoduAsync } from '@/lib/reference-data'
import { matchPozKodu, getPozDetailsAsync } from '@/lib/poz-matcher'

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

    // ADIM 1: Claude Vision ile SADECE OCR (POZ kodu secme!)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Bu bir ALKIM MİMARLIK şirketine ait el yazısıyla doldurulmuş TUTANAK FORMU görseli.
Formdaki TÜM bilgileri dikkatli okuyup JSON olarak çıkar. Sadece JSON döndür, başka hiçbir şey yazma.

DİKKAT - TÜRKÇE EL YAZISI OKUMA KURALLARI:
- Bu form TÜRKÇE el yazısıyla doldurulmuştur. Türkçe harflere dikkat et: ç, ş, ğ, ı, ö, ü, İ
- El yazısında harfler birbirine benzeyebilir. Bağlamdan doğru kelimeyi çıkar.
- "kafesi" kelimesini "karesi" olarak okuma - palet KAFESİ, sütlük KAFESİ doğrudur
- İnşaat/tadilat terimleri: izolasyon, boya, sıva, alçı, fayans, parke, doğrama, cam, çatı, teras, kolon, kiriş, duvar, söküm, yıkım, montaj, kafes, palet, raf, depo
- Bölge/şube isimleri: Türkiye'deki il, ilçe veya semt isimleri olabilir (örn: Kepez, Seyhan, Çukurova, Merkez vb.)

FORM ALANLARI (yukarıdan aşağıya):
1. N° yanındaki 6 haneli sayı = TUTANAK NUMARASI (no)
2. Tarih = GÜN.AY.YIL formatında oku (örn: 24.02.2026). Dikkatli oku, el yazısı rakamları karıştırma
3. "Tutanak Numarası" etiketi yanındaki yazı = genelde bölge bilgisi (ADANA, ANTALYA vb.)
4. "Bölge İsmi" etiketi yanındaki yazı = şube/bölge ismi (bolge)
5. "Mağaza İsmi" etiketi yanındaki yazı = mağaza adı VEYA mağaza kodu (3-5 haneli sayı)
   - Eğer sadece sayı yazıyorsa (örn: 10064) → magaza_no alanına yaz, magaza boş bırak
   - Eğer isim yazıyorsa → magaza alanına yaz
6. "Adres Bilgisi" yanındaki yazı = adres
7. "Çağrı No" yanındaki yazı = çağrı numarası
8. "Müdahale Ediliş Tarihi" = müdahale tarihi

İŞ KALEMLERİ ("Konu Hakkında Açıklamalar" bölümü):
- Her satırdaki iş kalemini AYRI AYRI oku
- Açıklamayı TUTANAKTA YAZDIĞI GİBİ yaz, düzeltme veya yorumlama yapma
- Miktar ve birim bilgisini ayır (örn: "4 adet", "20 m²", "15 mt", "= 110 m²")
- Eğer miktar belirtilmemişse miktar: 1, birim: "Adet" kullan

İMZA ALANI (formun alt kısmı):
- Sol alt: "Mimari Firma Sorumlusu" = firma_sorumlusu (isim-soyisim oku)
- Sağ alt: "Sorumlusu" = sorumlu (isim-soyisim oku, kaşe/mühürdeki ismi de oku)

JSON FORMAT:
{
  "no": "614544",
  "tarih": "24.02.2026",
  "mudahale_tarihi": "",
  "bolge": "KEPEZ BOYU ŞUBE",
  "magaza": "",
  "magaza_no": "10064",
  "adres": "",
  "cagri_no": "",
  "konu": "",
  "firma_sorumlusu": "Şükrü Yücel",
  "sorumlu": "Öznur Demir",
  "isler": [
    {"aciklama": "Palet kafesi ve sütlük kafesi çıtçıtı yapıldı", "miktar": 1, "birim": "Adet"},
    {"aciklama": "4 Palet çift", "miktar": 4, "birim": "Adet"},
    {"aciklama": "20 Metre kare çinko kolonildi", "miktar": 20, "birim": "m²"}
  ]
}

Okunamayan alanlar için boş string kullan. Tahmin etme, okunamıyorsa boş bırak.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('OCR sonucu parse edilemedi')

    const extracted = JSON.parse(jsonMatch[0])

    // Görseli Supabase Storage'a yükle
    const supabaseAdmin = getSupabaseAdmin()
    const fileName = `tutanak_${Date.now()}_${file.name}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('tutanaklar')
      .upload(fileName, buffer, { contentType: file.type })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('tutanaklar')
      .getPublicUrl(fileName)

    // Magaza bilgilerini referanstan bul
    // ONCELIK: magaza_no (3-5 haneli kod) varsa ona gore esle, yoksa isimle fuzzy ara
    let magazaMatch = null
    const ocrMagazaNo = String(extracted.magaza_no || '').trim()
    if (ocrMagazaNo) {
      magazaMatch = await findMagazaByKodAsync(ocrMagazaNo)
    }
    if (!magazaMatch && extracted.magaza) {
      magazaMatch = await findMagazaAsync(extracted.magaza)
    }

    // Dogrulama durumu kontrol
    const uyarilar: string[] = []

    if (ocrMagazaNo && !magazaMatch) {
      uyarilar.push(`Magaza kodu "${ocrMagazaNo}" referans veride bulunamadi`)
    }
    if (!ocrMagazaNo && !extracted.magaza) {
      uyarilar.push('Magaza kodu ve ismi okunamadi')
    }

    const dogrulamaDurumu = uyarilar.length > 0 ? 'uyari' : 'ok'

    // Magaza kodu uzerinden: B sutunu = magaza adi, C sutunu = idari bolge
    const fullMagazaAdi = magazaMatch?.magaza_adi || extracted.magaza || ''
    const magazaNo = magazaMatch?.kod || ocrMagazaNo || ''
    // Bolge bilgisi: magaza kodundan gelen idari bolge ONCELIKLI
    const bolgeBilgisi = magazaMatch?.yeni_idari_bolge || extracted.bolge || ''

    // Tutanak header kaydet
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
        aciklama: extracted.isler?.map((i: { aciklama: string }) => i.aciklama).join('; ') || '',
        firma_sorumlusu: extracted.firma_sorumlusu || '',
        sorumlu: extracted.sorumlu || '',
        gorsel_url: publicUrl,
        dogrulama_durumu: dogrulamaDurumu,
        dogrulama_notlari: uyarilar.join(' | '),
      })
      .select()
      .single()

    if (tutanakError) throw tutanakError

    // ADIM 2: Deterministik POZ eslestirme (kodda, LLM degil)
    const isler = extracted.isler || []
    const items = []
    for (let idx = 0; idx < isler.length; idx++) {
      const is_kalemi = isler[idx] as { aciklama: string; miktar: number; birim: string }
      const aciklama = is_kalemi.aciklama || ''
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

    return NextResponse.json({
      success: true,
      dogrulama_durumu: dogrulamaDurumu,
      uyarilar: uyarilar,
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
