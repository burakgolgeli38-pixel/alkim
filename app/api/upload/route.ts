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
Formdaki bilgileri okuyup JSON döndür. Sadece JSON, başka metin yazma.

═══════════════════════════════════════════
TÜRKÇE EL YAZISI OKUMA - KRİTİK KURALLAR
═══════════════════════════════════════════

Bu formlar Türkiye'deki inşaat/tadilat ustaları tarafından hızlı el yazısıyla doldurulur.
Yazılar genelde bozuk, harfler birbirine karışık, kısaltmalar ve argo kullanılır.

HARF OKUMA İPUÇLARI:
- El yazısında "a" ile "o" karışır → bağlama bak
- "ı" noktasız, "i" noktalı → Türkçe'de bu ayrım ÖNEMLİ
- "ş" ile "s", "ç" ile "c" birbirine benzer → kelime anlamına bak
- "ğ" genelde üst çizgi olarak yazılır
- Ustalar BÜYÜK HARF kullanmayı sever, küçük harfle de yazabilir
- Birleşik yazılan kelimeler ayrı ayrı oku

İNŞAAT TERİMLERİ SÖZLÜĞÜ (ustalar bunları yazar):
boru, kapama, kapak, kafes, palet, sütlük, raf, depo, reyon, ranza
izolasyon/izalasyon, boya, sıva, alçı, alçıpan, fayans, seramik
parke, laminat, doğrama, cam, çatı, teras, kolon, kiriş, duvar
söküm, yıkım, montaj, demontaj, tamir, onarım, bakım, tadilat
membran, şap, beton, harç, derz, macun, astar, silikon, köpük
asma tavan, plaka, kartonpiyer, spotluk, led kanal
batarya, musluk, tesisat, gider, sifon, klozet, lavabo, pisuvar
hidrolik, panik bar, kilit, menteşe, kapı, pencere
sac, profil, çelik, kaynak, korkuluk, merdiven, platform
çinko, oluk, dere, yağmur borusu, iniş borusu
nakliye, sevkiyat, iskele, vinç, forklift
robot makina, hırsız örtü, dayson, pano, tablo

MAĞAZA KODU - ÇOK ÖNEMLİ:
- "Mağaza İsmi" alanında genelde 3-5 HANELİ bir SAYI yazar (örn: 1064, 10064, 856)
- Bu sayıyı DOĞRU oku, her rakamı dikkatle kontrol et
- Bazen yanına mağaza adı da yazılabilir (örn: "1064 GÖLBAŞI")
- Bazen SADECE mağaza adı yazılır (sayı olmadan)
- Sayı varsa → magaza_no'ya yaz
- İsim varsa → magaza'ya yaz
- İkisi de varsa → ikisini de yaz

FORM YAPISI (yukarıdan aşağıya sırayla):
┌──────────────────────────────────────────────────┐
│ N° [6 haneli basılı numara]     Tarih [el yazısı]│
│ Tutanak Numarası:        Müdahale Ediliş Tarihi: │
│ Bölge İsmi:              Mağaza İsmi:            │
│ Adres Bilgisi:           Çağrı No:               │
│ KONU: [konu başlığı]                             │
│ ─── Konu Hakkında Açıklamalar ───                │
│ 1) [iş kalemi 1]                                 │
│ 2) [iş kalemi 2]                                 │
│ 3) [iş kalemi 3]                                 │
│ ...                                              │
│ Mimari Firma Sorumlusu:    Sorumlusu:            │
│ [imza + isim]              [kaşe/imza + isim]    │
└──────────────────────────────────────────────────┘

ALAN OKUMA DETAYLARI:
1. N° = Form üstünde basılı 6 haneli numara (dijital baskı, kolay okunur)
2. Tarih = Sağ üstte GG.AA.YYYY (veya GG/AA/YYYY). 2025 veya 2026 yılı olmalı
3. Müdahale Ediliş Tarihi = İşin yapıldığı tarih
4. Bölge İsmi = Türkiye il/ilçe/semt adı olabilir ama ÖNEMLİ DEĞİL, biz bunu mağaza kodundan buluyoruz
5. Mağaza İsmi = MAĞAZA KODU (sayı) veya mağaza adı - BU ALAN ÇOK KRİTİK
6. Çağrı No = Genelde "HASTANE", "ACİL" gibi veya boş olabilir. Sayı da olabilir.
7. KONU = Kısa açıklama veya bir sayı (bazen tutar yazarlar)

İŞ KALEMLERİ - KRİTİK BÖLÜM:
- "Konu Hakkında Açıklamalar" altında numaralı veya numarasız satırlar halinde yazılır
- Her SATIRDA bir veya BİRDEN FAZLA iş olabilir
- Eğer bir satırda "ve" veya virgülle ayrılmış FARKLI işler varsa, bunları AYRI iş kalemleri olarak böl
  Örnek: "boru kapama ve klima tesisat yapıldı" → 2 ayrı iş kalemi:
    1) "boru kapama yapıldı"
    2) "klima tesisat yapıldı"
  Örnek: "palet kafesi, sütlük kafesi çıtçıtı yapıldı" → 2 ayrı iş kalemi:
    1) "palet kafesi çıtçıtı yapıldı"
    2) "sütlük kafesi çıtçıtı yapıldı"
- Ancak aynı işin parçasıysa ayırma: "boru kapama ve izolasyon yapıldı" → bu TEK iştir
- Miktar + birim ayır: "4 adet", "20 m²", "15 mt", "10 ad", "= 110 m²"
- "mt" veya "metre" = m (metre uzunluk), "m²" veya "metrekare" = m², "ad" veya "adet" = Adet
- Miktar yoksa → miktar: 1, birim: "Adet"
- ÖNEMLİ: Ustanın yazdığını OLDUĞU GİBİ oku. Düzeltme/yorumlama YAPMA.
- Ama Türkçe kelime olarak anlamlı hale getir (rastgele harf dizisi yazma)

İMZA ALANI:
- Sol alt "Mimari Firma Sorumlusu" = ALKIM çalışanı isim-soyisim
- Sağ alt "Sorumlusu" = Mağaza sorumlusu isim-soyisim (kaşe varsa kaşeden oku)
- "Kaşe Yoktur" yazıyorsa → sorumlu alanına "Kaşe Yoktur" + varsa ismi yaz

JSON FORMAT:
{
  "no": "607103",
  "tarih": "08.03.2026",
  "mudahale_tarihi": "08.03.2026",
  "bolge": "",
  "magaza": "GÖLBAŞI",
  "magaza_no": "",
  "adres": "",
  "cagri_no": "HASTANE",
  "konu": "122.40",
  "firma_sorumlusu": "Mustafa Özcan",
  "sorumlu": "Tuğçe Gemici",
  "isler": [
    {"aciklama": "1 Adet boru kapama yapıldı", "miktar": 1, "birim": "Adet"},
    {"aciklama": "Klima tamiri yapıldı", "miktar": 1, "birim": "Adet"},
    {"aciklama": "Reyon arkasında ilave yer boyası yapıldı 10 m²", "miktar": 10, "birim": "m²"}
  ]
}

Okunamayan alanlar için boş string kullan. Tahmin yapma, okunamıyorsa boş bırak.`,
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
    // Dosya adini sanitize et - Turkce karakter ve bosluklari temizle
    const safeOrigName = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // aksan isareti kaldir
      .replace(/[^a-zA-Z0-9._-]/g, '_') // ozel karakter -> _
      .replace(/_+/g, '_') // ardisik _ temizle
      .replace(/^_|_$/g, '') // bas/son _ temizle
    const ext = safeOrigName.includes('.') ? safeOrigName.split('.').pop() : 'jpg'
    const fileName = `tutanak_${Date.now()}.${ext}`
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
    let ocrMagazaNo = String(extracted.magaza_no || '').trim()

    // Bazen magaza alaninda hem kod hem isim yazar (orn: "1064 GOLBASI")
    // veya sadece magaza alanina kod yazilir (magaza_no bos birakilir)
    const ocrMagaza = String(extracted.magaza || '').trim()
    if (!ocrMagazaNo && ocrMagaza) {
      const kodMatch = ocrMagaza.match(/\b(\d{3,5})\b/)
      if (kodMatch) {
        ocrMagazaNo = kodMatch[1]
      }
    }

    if (ocrMagazaNo) {
      magazaMatch = await findMagazaByKodAsync(ocrMagazaNo)
    }
    if (!magazaMatch && ocrMagaza) {
      magazaMatch = await findMagazaAsync(ocrMagaza)
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
    // Bolge bilgisi: SADECE magaza kodundan gelen idari bolge kullan
    // OCR'dan gelen bolge bilgisi guvenilmez (yanlis okuyor), kullanma
    const bolgeBilgisi = magazaMatch?.yeni_idari_bolge || ''

    if (!magazaMatch?.yeni_idari_bolge && ocrMagazaNo) {
      uyarilar.push(`Magaza kodu "${ocrMagazaNo}" icin bolge bilgisi bulunamadi`)
    }

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
