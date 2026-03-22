import birimFiyatlarData from '@/data/birim-fiyatlar.json'
import magazalarData from '@/data/magazalar.json'
import { getSupabaseAdmin } from './supabase'

export interface BirimFiyat {
  poz_no: string
  poz_tanimi: string
  poz_birim_fiyat_tarifesi: string
  marka_model: string
  birim: string
  birim_fiyat: number
}

export interface Magaza {
  kod: string
  magaza_adi: string
  yeni_idari_bolge: string
  yeni_bolge_muduru: string
  yeni_bolge_yoneticisi: string
  idari_isler_sorumlusu?: string
}

// Cache
let _birimFiyatlarJSON: BirimFiyat[] | null = null
let _birimFiyatlarDB: BirimFiyat[] | null = null
let _birimFiyatlarDBTime = 0
let _magazalarDB: Magaza[] | null = null
let _magazalarDBTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 dakika

// JSON fallback
function getJSONBirimFiyatlar(): BirimFiyat[] {
  if (!_birimFiyatlarJSON) {
    _birimFiyatlarJSON = birimFiyatlarData as BirimFiyat[]
  }
  return _birimFiyatlarJSON
}

function getJSONMagazalar(): Magaza[] {
  return magazalarData as Magaza[]
}

// Supabase'den birim fiyatlari yukle (cache ile)
async function getDBBirimFiyatlar(): Promise<BirimFiyat[] | null> {
  if (_birimFiyatlarDB && Date.now() - _birimFiyatlarDBTime < CACHE_TTL) {
    return _birimFiyatlarDB
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('birim_fiyatlar')
      .select('poz_no, poz_tanimi, poz_birim_fiyat_tarifesi, marka_model, birim, birim_fiyat')
      .eq('is_active', true)

    if (error) throw error
    if (!data || data.length === 0) return null

    _birimFiyatlarDB = data.map(d => ({
      poz_no: d.poz_no,
      poz_tanimi: d.poz_tanimi || '',
      poz_birim_fiyat_tarifesi: d.poz_birim_fiyat_tarifesi || '',
      marka_model: d.marka_model || '',
      birim: d.birim || '',
      birim_fiyat: Number(d.birim_fiyat) || 0,
    }))
    _birimFiyatlarDBTime = Date.now()
    return _birimFiyatlarDB
  } catch {
    return null
  }
}

// Supabase'den magazalari yukle (cache ile)
async function getDBMagazalar(): Promise<Magaza[] | null> {
  if (_magazalarDB && Date.now() - _magazalarDBTime < CACHE_TTL) {
    return _magazalarDB
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('magazalar')
      .select('kod, magaza_adi, idari_bolge, idari_isler_sorumlusu')
      .eq('is_active', true)

    if (error) throw error
    if (!data || data.length === 0) return null

    _magazalarDB = data.map(m => ({
      kod: m.kod,
      magaza_adi: m.magaza_adi,
      yeni_idari_bolge: m.idari_bolge || '',
      yeni_bolge_muduru: '',
      yeni_bolge_yoneticisi: '',
      idari_isler_sorumlusu: m.idari_isler_sorumlusu || '',
    }))
    _magazalarDBTime = Date.now()
    return _magazalarDB
  } catch {
    return null
  }
}

// ---- POZ Kodu / Birim Fiyat ----

// Async: Supabase oncelikli
export async function findPozKoduAsync(pozNo: string): Promise<BirimFiyat | null> {
  const normalized = pozNo.trim().toUpperCase()
  if (normalized === 'S-09') return null

  // Once Supabase'de ara
  const dbList = await getDBBirimFiyatlar()
  if (dbList) {
    const found = dbList.find(b => b.poz_no.trim().toUpperCase() === normalized)
    if (found) return found
  }
  // Supabase'de yoksa JSON fallback
  const jsonList = getJSONBirimFiyatlar()
  return jsonList.find(b => b.poz_no.trim().toUpperCase() === normalized) || null
}

// Sync: cache veya JSON
export function findPozKodu(pozNo: string): BirimFiyat | null {
  const normalized = pozNo.trim().toUpperCase()
  if (normalized === 'S-09') return null
  const list = _birimFiyatlarDB || getJSONBirimFiyatlar()
  return list.find(b => b.poz_no.trim().toUpperCase() === normalized) || null
}

// Sync getter (eski uyumluluk)
export function getBirimFiyatlar(): BirimFiyat[] {
  return _birimFiyatlarDB || getJSONBirimFiyatlar()
}

// ---- Turkce normalize ----

function normalizeTurkish(str: string): string {
  return str
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- Magaza Eslestirme ----

export async function findMagazaAsync(magazaAdi: string): Promise<Magaza | null> {
  // Once Supabase'de ara
  const dbList = await getDBMagazalar()
  if (dbList) {
    const found = matchMagazaFromList(magazaAdi, dbList)
    if (found) return found
  }
  // Supabase'de yoksa JSON fallback
  return matchMagazaFromList(magazaAdi, getJSONMagazalar())
}

export function findMagaza(magazaAdi: string): Magaza | null {
  const list = _magazalarDB || getJSONMagazalar()
  return matchMagazaFromList(magazaAdi, list)
}

function matchMagazaFromList(magazaAdi: string, list: Magaza[]): Magaza | null {
  const normalized = normalizeTurkish(magazaAdi)

  const exact = list.find(m => normalizeTurkish(m.magaza_adi) === normalized)
  if (exact) return exact

  const partial = list.find(m => {
    const mNorm = normalizeTurkish(m.magaza_adi)
    return mNorm.includes(normalized) || normalized.includes(mNorm)
  })
  if (partial) return partial

  const words = normalized.split(' ').filter(w => w.length > 2)
  let bestMatch: Magaza | null = null
  let bestScore = 0

  for (const m of list) {
    const mNorm = normalizeTurkish(m.magaza_adi)
    const matchCount = words.filter(w => mNorm.includes(w)).length
    const score = matchCount / words.length
    if (score > bestScore && score >= 0.5) {
      bestScore = score
      bestMatch = m
    }
  }

  return bestMatch
}

export async function findMagazaByKodAsync(kod: string): Promise<Magaza | null> {
  const trimmed = kod.trim()
  // Once Supabase'de ara
  const dbList = await getDBMagazalar()
  if (dbList) {
    const found = dbList.find(m => m.kod === trimmed)
    if (found) return found
  }
  // Supabase'de yoksa JSON fallback'te de ara
  const jsonList = getJSONMagazalar()
  return jsonList.find(m => m.kod === trimmed) || null
}

export function findMagazaByKod(kod: string): Magaza | null {
  const list = _magazalarDB || getJSONMagazalar()
  return list.find(m => m.kod === kod.trim()) || null
}

// ---- Magaza Kodu Fuzzy Arama ----

/**
 * Magaza kodu tam eslesmediyse, 1 rakam farkla olasilari bulur
 * Ornek: "1064" bulunamazsa → "1164", "1054", "1074" gibi onerileri doner
 */
export async function findSimilarMagazaKodlariAsync(kod: string): Promise<Array<{ kod: string; magaza_adi: string; bolge: string }>> {
  const dbList = await getDBMagazalar()
  const jsonList = getJSONMagazalar()
  const allList = [...(dbList || []), ...jsonList]

  // Tekrarlari kaldir
  const seen = new Set<string>()
  const unique = allList.filter(m => {
    if (seen.has(m.kod)) return false
    seen.add(m.kod)
    return true
  })

  const suggestions: Array<{ kod: string; magaza_adi: string; bolge: string; dist: number }> = []

  for (const m of unique) {
    // Ayni hane sayisinda kontrol et
    if (Math.abs(kod.length - m.kod.length) > 1) continue

    const dist = levenshteinDist(kod, m.kod)
    if (dist >= 1 && dist <= 2) {
      suggestions.push({
        kod: m.kod,
        magaza_adi: m.magaza_adi,
        bolge: m.yeni_idari_bolge,
        dist,
      })
    }
  }

  return suggestions
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5)
    .map(s => ({ kod: s.kod, magaza_adi: s.magaza_adi, bolge: s.bolge }))
}

function levenshteinDist(a: string, b: string): number {
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

// Cache temizle
export function clearMagazaCache() {
  _magazalarDB = null
  _magazalarDBTime = 0
}

export function clearBirimFiyatCache() {
  _birimFiyatlarDB = null
  _birimFiyatlarDBTime = 0
}
