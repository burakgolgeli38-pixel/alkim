/**
 * OCR Engine - Perfectionist Türkçe El Yazısı Okuma Sistemi
 *
 * 2-Pass OCR + Post-OCR Düzeltme + Güven Skoru + Fuzzy Mağaza Eşleştirme
 */

import Anthropic from '@anthropic-ai/sdk'

// ============================================================
// İNŞAAT TERİMLERİ SÖZLÜĞÜ
// OCR'dan çıkan bozuk kelimeleri düzeltmek için kullanılır
// ============================================================

const INSAAT_TERIMLERI = [
  // Genel inşaat
  'boru', 'kapama', 'kapak', 'kafes', 'palet', 'sütlük', 'raf', 'depo', 'reyon', 'ranza',
  'izolasyon', 'izalasyon', 'boya', 'boyası', 'sıva', 'alçı', 'alçıpan', 'fayans', 'seramik',
  'parke', 'laminat', 'doğrama', 'cam', 'çatı', 'teras', 'kolon', 'kiriş', 'duvar',
  'söküm', 'yıkım', 'montaj', 'demontaj', 'tamir', 'tamiri', 'onarım', 'bakım', 'tadilat',
  'membran', 'şap', 'beton', 'harç', 'derz', 'macun', 'astar', 'silikon', 'köpük',
  'asma', 'tavan', 'plaka', 'kartonpiyer', 'spotluk', 'kanal',
  'batarya', 'musluk', 'tesisat', 'gider', 'sifon', 'klozet', 'lavabo', 'pisuvar',
  'hidrolik', 'panik', 'kilit', 'menteşe', 'kapı', 'pencere',
  'sac', 'profil', 'çelik', 'kaynak', 'korkuluk', 'merdiven', 'platform',
  'çinko', 'oluk', 'dere', 'yağmur', 'iniş',
  'nakliye', 'sevkiyat', 'iskele', 'vinç', 'forklift',
  'robot', 'makina', 'hırsız', 'örtü', 'pano', 'tablo',
  // Eylemler
  'yapıldı', 'yapıldi', 'döşendi', 'çekildi', 'sürüldü', 'boyandı', 'takıldı',
  'değiştirildi', 'söküldü', 'kırıldı', 'temizlendi', 'onarıldı', 'monte', 'edildi',
  'çıtçıtı', 'çıtçıt', 'kaplandı', 'kaplanması',
  // Birimler
  'adet', 'metre', 'metrekare', 'kilogram',
  // Yapı elemanları
  'kolon', 'kiriş', 'döşeme', 'temel', 'çatı', 'cephe', 'teras', 'balkon',
  'duvar', 'bölme', 'perde', 'merdiven', 'asansör', 'rampa',
  // Malzeme
  'tuğla', 'ytong', 'bims', 'panel', 'sandviç', 'eternit', 'polikarbon',
  'granit', 'mermer', 'traverten', 'porselen', 'vitrifiye',
  'PVC', 'alüminyum', 'galvaniz', 'paslanmaz',
  // Tesisat
  'pis', 'temiz', 'sıcak', 'soğuk', 'yangın', 'sprinkler', 'hidrant',
  'kazan', 'kombi', 'klima', 'fan', 'coil', 'split', 'kaset',
  'elektrik', 'kablo', 'priz', 'anahtar', 'sigorta', 'trafo',
  // Yer/alan
  'zemin', 'tavan', 'duvar', 'cephe', 'iç', 'dış', 'arka', 'ön',
  'depo', 'ofis', 'wc', 'mutfak', 'koridor', 'giriş', 'çıkış',
  'arkası', 'arkasında', 'önünde', 'altında', 'üstünde', 'yanında',
  'ilave', 'ek', 'yeni', 'mevcut', 'eski',
]

// ============================================================
// LEVENSHTEIN DISTANCE - Fuzzy matching için
// ============================================================

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

function normalizeTR(str: string): string {
  return str
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/İ/g, 'i').replace(/Ğ/g, 'g').replace(/Ü/g, 'u')
    .replace(/Ş/g, 's').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
}

// ============================================================
// POST-OCR METİN DÜZELTİCİ
// ============================================================

/**
 * OCR'dan çıkan her kelimeyi inşaat terimleri sözlüğüne karşı kontrol eder.
 * Eşleşmeyen kelimeleri fuzzy match ile düzeltmeye çalışır.
 */
export function correctOCRText(text: string): { corrected: string; corrections: string[] } {
  const corrections: string[] = []
  const words = text.split(/\s+/)
  const correctedWords: string[] = []

  for (const word of words) {
    // Sayıları, kısa kelimeleri ve zaten bilinen terimleri atla
    if (/^\d+/.test(word) || word.length <= 2) {
      correctedWords.push(word)
      continue
    }

    const normalized = normalizeTR(word.replace(/[.,;:!?'"()]/g, ''))
    const punctuation = word.match(/[.,;:!?'"()]+$/)
    const suffix = punctuation ? punctuation[0] : ''

    // Terimlerde birebir var mı?
    const exactMatch = INSAAT_TERIMLERI.find(t => normalizeTR(t) === normalized)
    if (exactMatch) {
      correctedWords.push(word) // zaten doğru
      continue
    }

    // Fuzzy match - max 2 Levenshtein mesafesi
    let bestMatch: string | null = null
    let bestDist = Infinity

    for (const term of INSAAT_TERIMLERI) {
      const termNorm = normalizeTR(term)
      // Sadece benzer uzunlukta kelimeleri karşılaştır
      if (Math.abs(termNorm.length - normalized.length) > 2) continue

      const dist = levenshtein(normalized, termNorm)
      const threshold = normalized.length <= 4 ? 1 : 2

      if (dist <= threshold && dist < bestDist) {
        bestDist = dist
        bestMatch = term
      }
    }

    if (bestMatch && bestDist > 0) {
      corrections.push(`"${word}" → "${bestMatch}" (mesafe: ${bestDist})`)
      correctedWords.push(bestMatch + suffix)
    } else {
      correctedWords.push(word)
    }
  }

  return {
    corrected: correctedWords.join(' '),
    corrections,
  }
}

// ============================================================
// MAĞAZA KODU FUZZY ARAMA
// ============================================================

export interface MagazaKodSuggestion {
  kod: string
  magaza_adi: string
  mesafe: number
}

/**
 * Mağaza kodu tam eşleşmezse, 1 rakam farkla olası eşleşmeleri bulur
 */
export function findSimilarMagazaKodlari(
  kod: string,
  magazalar: Array<{ kod: string; magaza_adi: string }>
): MagazaKodSuggestion[] {
  const suggestions: MagazaKodSuggestion[] = []

  for (const m of magazalar) {
    const dist = levenshtein(kod, m.kod)
    // Aynı hane sayısında, max 1 rakam fark
    if (dist === 1 && Math.abs(kod.length - m.kod.length) <= 1) {
      suggestions.push({
        kod: m.kod,
        magaza_adi: m.magaza_adi,
        mesafe: dist,
      })
    }
  }

  // Mesafeye göre sırala
  return suggestions.sort((a, b) => a.mesafe - b.mesafe).slice(0, 5)
}

// ============================================================
// 2-PASS OCR SİSTEMİ
// ============================================================

interface OCRField {
  deger: string
  guven: number
}

interface OCRIsKalemi {
  aciklama: string
  miktar: number
  birim: string
  guven: number
}

interface OCRSonuc {
  no: string
  tarih: string
  mudahale_tarihi: string
  bolge: string
  magaza: string
  magaza_no: string
  adres: string
  cagri_no: string
  konu: string
  firma_sorumlusu: string
  sorumlu: string
  isler: OCRIsKalemi[]
  field_confidence: Record<string, number>
}

const OCR_SYSTEM_PROMPT = `Sen bir inşaat/tadilat sektöründe uzmanlaşmış Türkçe el yazısı OCR sistemisin.
ALKIM Mimarlık şirketinin tutanak formlarını okuyorsun.

TEMEL GÖREVİN:
- El yazısıyla doldurulmuş form görselinden bilgileri doğru çıkarmak
- Her alan için 0-1 arası güven skoru vermek
- İnşaat terminolojisini bilmek ve bağlamdan doğru kelimeyi çıkarmak

SEN BİR İNŞAAT UZMANISIN. Bu kelimeleri iyi bilirsin:
boru kapama, palet kafesi, sütlük kafesi, raf montajı, reyon düzenlemesi
izolasyon, membran, şap, beton, harç, sıva, alçı, alçıpan, macun, astar
boya (plastik/yağlı/dış cephe), seramik, fayans, granit, parke, laminat
asma tavan, plaka, kartonpiyer, spotluk, led kanal
tesisat, batarya, musluk, gider, sifon, klozet, lavabo
hidrolik, panik bar, kilit, menteşe, doğrama, cam
sac, profil, çelik, kaynak, korkuluk, merdiven
çatı, oluk, dere, yağmur borusu, çinko
söküm, yıkım, kırım, montaj, demontaj, nakliye, iskele`

function buildOCRPrompt(pass: 'first' | 'second', previousResult?: string): string {
  const basePrompt = `Bu görseldeki ALKIM MİMARLIK TUTANAK FORMU'nu oku.

═══════════════════════════════════════════
MAĞAZA KODU - EN KRİTİK ALAN
═══════════════════════════════════════════
"Mağaza İsmi" alanında genelde 3-5 HANELİ bir SAYI yazar.
Bu sayıyı ÇOK DİKKATLİ oku. Her rakamı tek tek doğrula.
El yazısında: 1↔7, 4↔9, 3↔8, 6↔0 karışabilir.
Bağlama bak: Mağaza kodu genelde 3-5 hane arası bir sayıdır.

FORM YAPISI:
┌──────────────────────────────────────────────────┐
│ N° [basılı 6 hane]              Tarih [el yazısı]│
│ Tutanak Numarası:        Müdahale Ediliş Tarihi: │
│ Bölge İsmi:              Mağaza İsmi: [KRİTİK]  │
│ Adres Bilgisi:           Çağrı No:               │
│ KONU: [kısa açıklama veya tutar]                 │
│ ─── Konu Hakkında Açıklamalar ───                │
│ [numaralı iş kalemleri listesi]                  │
│ Mimari Firma Sorumlusu:    Sorumlusu:            │
└──────────────────────────────────────────────────┘

İŞ KALEMLERİ OKUMA KURALLARI:
1. Her satırı DİKKATLİ oku - inşaat/tadilat terimleri bekleniyor
2. Bir satırda BİRDEN FAZLA farklı iş varsa ("ve" / virgülle ayrılmış) → AYRI kalemlere böl
   Örnek: "palet kafesi ve sütlük kafesi çıtçıtı yapıldı" → 2 ayrı kalem
   Örnek: "boru kapama, klima tesisat yapıldı" → 2 ayrı kalem
3. Ama aynı işin parçasıysa BÖLME: "boru kapama ve izolasyon yapıldı" → 1 kalem
4. Miktar + birim varsa ayır: "4 adet", "20 m²", "15 mt", "10 ad"
5. Miktar yoksa → miktar: 1, birim: "Adet"
6. Ustanın yazısı bozuk olabilir ama ANLAMLI Türkçe kelimeler çıkar
7. "mt" = metre, "m²" veya "m2" = metrekare, "ad" = adet, "kg" = kilogram

İMZA ALANI:
- Sol alt "Mimari Firma Sorumlusu" = isim soyisim
- Sağ alt "Sorumlusu" = isim soyisim (kaşe varsa kaşeden oku)

GÜVEN SKORU:
Her alan ve her iş kalemi için 0.0-1.0 arası güven skoru ver.
- 1.0 = kesinlikle doğru okudum (basılı/net yazı)
- 0.7-0.9 = yüksek ihtimalle doğru
- 0.4-0.6 = emin değilim ama en iyi tahminim
- 0.0-0.3 = çok belirsiz, neredeyse okunamıyor

Sadece JSON döndür, başka metin YAZMA.

{
  "no": {"deger": "607103", "guven": 0.99},
  "tarih": {"deger": "08.03.2026", "guven": 0.85},
  "mudahale_tarihi": {"deger": "08.03.2026", "guven": 0.80},
  "bolge": {"deger": "", "guven": 0.0},
  "magaza": {"deger": "GÖLBAŞI", "guven": 0.75},
  "magaza_no": {"deger": "1064", "guven": 0.90},
  "adres": {"deger": "", "guven": 0.0},
  "cagri_no": {"deger": "HASTANE", "guven": 0.70},
  "konu": {"deger": "122.40", "guven": 0.65},
  "firma_sorumlusu": {"deger": "Mustafa Özcan", "guven": 0.80},
  "sorumlu": {"deger": "Tuğçe Gemici", "guven": 0.85},
  "isler": [
    {"aciklama": "1 Adet boru kapama yapıldı", "miktar": 1, "birim": "Adet", "guven": 0.85},
    {"aciklama": "Klima tamiri yapıldı", "miktar": 1, "birim": "Adet", "guven": 0.70},
    {"aciklama": "Reyon arkasında ilave yer boyası 10 m²", "miktar": 10, "birim": "m²", "guven": 0.60}
  ]
}`

  if (pass === 'second' && previousResult) {
    return `${basePrompt}

═══════════════════════════════════════════
2. GEÇİŞ - DOĞRULAMA VE DÜZELTME
═══════════════════════════════════════════
İlk okumada şu sonuç çıktı:
${previousResult}

Görsele TEKRAR bak. Özellikle güven skoru düşük (<0.7) olan alanlara ODAKLAN.
- Mağaza kodunu TEKRAR oku - her rakamı kontrol et
- İş kalemlerini TEKRAR oku - inşaat terimi olarak anlamlı mı?
- İsimleri TEKRAR oku
- İlk okumada hata yaptıysan DÜZELT

Düzeltilmiş JSON'ı aynı formatta döndür.`
  }

  return basePrompt
}

// ============================================================
// ANA OCR FONKSİYONU
// ============================================================

export interface OCRResult {
  extracted: {
    no: string
    tarih: string
    mudahale_tarihi: string
    bolge: string
    magaza: string
    magaza_no: string
    adres: string
    cagri_no: string
    konu: string
    firma_sorumlusu: string
    sorumlu: string
    isler: Array<{ aciklama: string; miktar: number; birim: string }>
  }
  confidence: {
    overall: number
    fields: Record<string, number>
    low_confidence_fields: string[]
  }
  corrections: string[]
  passes_used: number
}

export async function runOCR(
  anthropic: Anthropic,
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<OCRResult> {

  // ---- PASS 1: İlk okuma ----
  const pass1Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: OCR_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: buildOCRPrompt('first') },
      ],
    }],
  })

  const pass1Text = pass1Response.content[0].type === 'text' ? pass1Response.content[0].text : ''
  const pass1Match = pass1Text.match(/\{[\s\S]*\}/)
  if (!pass1Match) throw new Error('OCR Pass 1: JSON parse edilemedi')

  const pass1Data = JSON.parse(pass1Match[0])

  // Güven skorlarını kontrol et
  const lowConfFields: string[] = []
  const fieldConfidence: Record<string, number> = {}
  let totalConf = 0
  let fieldCount = 0

  const fieldNames = ['no', 'tarih', 'mudahale_tarihi', 'magaza', 'magaza_no', 'konu', 'firma_sorumlusu', 'sorumlu']
  for (const field of fieldNames) {
    const val = pass1Data[field]
    const conf = typeof val === 'object' && val?.guven !== undefined ? val.guven : 0.5
    fieldConfidence[field] = conf
    totalConf += conf
    fieldCount++
    if (conf < 0.7 && (typeof val === 'object' ? val.deger : val)) {
      lowConfFields.push(field)
    }
  }

  // İş kalemleri güven kontrolü
  const isler = pass1Data.isler || []
  let islerLowConf = false
  for (const is of isler) {
    const conf = is.guven || 0.5
    if (conf < 0.7) islerLowConf = true
    totalConf += conf
    fieldCount++
  }
  if (islerLowConf) lowConfFields.push('isler')

  const overallConf = fieldCount > 0 ? totalConf / fieldCount : 0.5

  // ---- PASS 2: Düşük güvenli alanlar varsa tekrar oku ----
  let finalData = pass1Data
  let passesUsed = 1

  // Mağaza kodu her zaman kritik - güven 1.0 olmadığı sürece 2. geçiş
  const magazaNoConf = fieldConfidence['magaza_no'] || 0
  const needsPass2 = lowConfFields.length >= 2 || magazaNoConf < 0.95 || islerLowConf

  if (needsPass2) {
    try {
      const pass2Response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: OCR_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: buildOCRPrompt('second', JSON.stringify(pass1Data, null, 2)) },
          ],
        }],
      })

      const pass2Text = pass2Response.content[0].type === 'text' ? pass2Response.content[0].text : ''
      const pass2Match = pass2Text.match(/\{[\s\S]*\}/)
      if (pass2Match) {
        finalData = JSON.parse(pass2Match[0])
        passesUsed = 2

        // Güven skorlarını güncelle
        for (const field of fieldNames) {
          const val = finalData[field]
          if (typeof val === 'object' && val?.guven !== undefined) {
            fieldConfidence[field] = val.guven
          }
        }
      }
    } catch (err) {
      console.warn('OCR Pass 2 hatası, Pass 1 sonucu kullanılacak:', err)
    }
  }

  // ---- Veriyi düzleştir (güven objelerinden değer çıkar) ----
  function extractValue(field: unknown): string {
    if (typeof field === 'object' && field !== null && 'deger' in field) {
      return String((field as { deger: string }).deger || '')
    }
    return String(field || '')
  }

  const extractedIsler: Array<{ aciklama: string; miktar: number; birim: string }> = []
  const finalIsler = finalData.isler || []

  for (const is of finalIsler) {
    const aciklama = typeof is.aciklama === 'object' ? is.aciklama.deger : (is.aciklama || '')
    if (!aciklama) continue

    // Post-OCR metin düzeltme uygula
    const { corrected } = correctOCRText(aciklama)

    extractedIsler.push({
      aciklama: corrected,
      miktar: is.miktar || 1,
      birim: is.birim || 'Adet',
    })
  }

  // Firma sorumlusu ve sorumlu düzeltme
  const firmaSorumlusu = extractValue(finalData.firma_sorumlusu)
  const sorumlu = extractValue(finalData.sorumlu)

  // Tüm düzeltmeleri topla
  const allCorrections: string[] = []
  for (const is of finalIsler) {
    const orig = typeof is.aciklama === 'object' ? is.aciklama.deger : (is.aciklama || '')
    const { corrections } = correctOCRText(orig)
    allCorrections.push(...corrections)
  }

  // Güven skorlarını tekrar hesapla
  let finalTotalConf = 0
  let finalFieldCount = 0
  for (const field of fieldNames) {
    finalTotalConf += fieldConfidence[field] || 0.5
    finalFieldCount++
  }
  for (const is of finalIsler) {
    finalTotalConf += is.guven || 0.5
    finalFieldCount++
  }

  const finalLowConf: string[] = []
  for (const field of fieldNames) {
    if ((fieldConfidence[field] || 0) < 0.7) {
      const val = extractValue(finalData[field])
      if (val) finalLowConf.push(field)
    }
  }

  return {
    extracted: {
      no: extractValue(finalData.no),
      tarih: extractValue(finalData.tarih),
      mudahale_tarihi: extractValue(finalData.mudahale_tarihi),
      bolge: extractValue(finalData.bolge),
      magaza: extractValue(finalData.magaza),
      magaza_no: extractValue(finalData.magaza_no),
      adres: extractValue(finalData.adres),
      cagri_no: extractValue(finalData.cagri_no),
      konu: extractValue(finalData.konu),
      firma_sorumlusu: firmaSorumlusu,
      sorumlu: sorumlu,
      isler: extractedIsler,
    },
    confidence: {
      overall: finalFieldCount > 0 ? finalTotalConf / finalFieldCount : 0.5,
      fields: fieldConfidence,
      low_confidence_fields: finalLowConf,
    },
    corrections: [...new Set(allCorrections)], // unique
    passes_used: passesUsed,
  }
}
