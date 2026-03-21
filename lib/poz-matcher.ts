import { findPozKodu, findPozKoduAsync } from './reference-data'
import { getSupabaseAdmin } from './supabase'

// Turkce karakter normalize
function normalize(str: string): string {
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

interface MatchRule {
  keywords: string[]
  exclude_keywords?: string[] | null
  poz_kodu: string
  priority: number
  id?: string
}

// ============================================================
// CACHE: Supabase'den yuklenen kurallar 5dk onbellekte tutulur
// ============================================================
let _cachedRules: MatchRule[] | null = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 dakika

/**
 * Cache'i temizle (admin kural degisikligi sonrasi cagirilir)
 */
export function clearRuleCache() {
  _cachedRules = null
  _cacheTime = 0
}

/**
 * Kurallari Supabase'den yukle (cache ile)
 * Hata durumunda SEED_RULES fallback kullanilir
 */
async function loadRules(): Promise<MatchRule[]> {
  if (_cachedRules && Date.now() - _cacheTime < CACHE_TTL) {
    return _cachedRules
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('poz_match_rules')
      .select('id, keywords, exclude_keywords, poz_kodu, priority')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) throw error
    if (!data || data.length === 0) throw new Error('Kural bulunamadi')

    _cachedRules = data
    _cacheTime = Date.now()
    return _cachedRules
  } catch (err) {
    console.warn('Supabase kural yukleme hatasi, fallback kullaniliyor:', err)
    if (_cachedRules) return _cachedRules
    return SEED_RULES
  }
}

/**
 * Deterministik POZ kodu eslestirme
 * Kurallar Supabase'den yuklenir, ayni aciklama her seferinde ayni POZ kodunu doner
 */
export async function matchPozKodu(aciklama: string): Promise<string> {
  const norm = normalize(aciklama)
  const rules = await loadRules()

  for (const rule of rules) {
    const allMatch = rule.keywords.every(kw => norm.includes(kw))
    if (!allMatch) continue

    const excludes = rule.exclude_keywords
    if (excludes && excludes.length > 0) {
      const hasExclude = excludes.some(ex => norm.includes(ex))
      if (hasExclude) continue
    }

    // Hit count guncelle (fire-and-forget, hataya duyarsiz)
    if (rule.id) {
      try {
        const supabase = getSupabaseAdmin()
        supabase.rpc('increment_hit_count', { rule_id: rule.id }).then(() => {})
      } catch {
        // ignore
      }
    }

    return rule.poz_kodu
  }

  return 'S-09'
}

/**
 * POZ koduna gore birim fiyat ve bilgileri getir
 */
export function getPozDetails(pozKodu: string): {
  poz_kodu: string
  poz_aciklama: string
  birim: string
  birim_fiyat: number
} {
  if (pozKodu === 'S-09') {
    return {
      poz_kodu: 'S-09',
      poz_aciklama: 'GENEL IS',
      birim: 'Adet',
      birim_fiyat: 0,
    }
  }

  const ref = findPozKodu(pozKodu)
  if (!ref) {
    return {
      poz_kodu: 'S-09',
      poz_aciklama: 'GENEL IS',
      birim: 'Adet',
      birim_fiyat: 0,
    }
  }

  return {
    poz_kodu: ref.poz_no,
    poz_aciklama: ref.poz_tanimi,
    birim: ref.birim,
    birim_fiyat: ref.birim_fiyat,
  }
}

/**
 * Async versiyon: Supabase birim fiyat tablosunu da kontrol eder
 */
export async function getPozDetailsAsync(pozKodu: string): Promise<{
  poz_kodu: string
  poz_aciklama: string
  birim: string
  birim_fiyat: number
}> {
  if (pozKodu === 'S-09') {
    return { poz_kodu: 'S-09', poz_aciklama: 'GENEL IS', birim: 'Adet', birim_fiyat: 0 }
  }

  const ref = await findPozKoduAsync(pozKodu)
  if (!ref) {
    return { poz_kodu: 'S-09', poz_aciklama: 'GENEL IS', birim: 'Adet', birim_fiyat: 0 }
  }

  return {
    poz_kodu: ref.poz_no,
    poz_aciklama: ref.poz_tanimi,
    birim: ref.birim,
    birim_fiyat: ref.birim_fiyat,
  }
}

// ============================================================
// SEED_RULES: Supabase erisim sorunu olursa fallback
// Bunlar migrasyon oncesi hardcoded kurallardir
// ============================================================
const SEED_RULES: MatchRule[] = [
  { keywords: ['surme', 'izalasyon'], poz_kodu: 'C-07', priority: 10 },
  { keywords: ['surme', 'izolasyon'], poz_kodu: 'C-07', priority: 11 },
  { keywords: ['cati', 'izalasyon'], exclude_keywords: ['temiz', 'cop'], poz_kodu: 'C-07', priority: 12 },
  { keywords: ['cati', 'izolasyon'], exclude_keywords: ['temiz', 'cop'], poz_kodu: 'C-07', priority: 13 },
  { keywords: ['likit', 'izolasyon'], poz_kodu: 'C-06', priority: 14 },
  { keywords: ['likit', 'izalasyon'], poz_kodu: 'C-06', priority: 15 },
  { keywords: ['likit', 'surme'], poz_kodu: 'C-06', priority: 16 },
  { keywords: ['puskurtme', 'izolasyon'], poz_kodu: 'C-08', priority: 17 },
  { keywords: ['puskurtme', 'izalasyon'], poz_kodu: 'C-08', priority: 18 },
  { keywords: ['membran'], poz_kodu: 'C-09', priority: 19 },
  { keywords: ['plastik', 'boya'], poz_kodu: 'F-03', priority: 20 },
  { keywords: ['tavan', 'boya'], exclude_keywords: ['yagli', 'yag', 'asma', 'sokum'], poz_kodu: 'F-03', priority: 21 },
  { keywords: ['nem', 'astar'], poz_kodu: 'F-07', priority: 22 },
  { keywords: ['is', 'astar'], poz_kodu: 'F-07', priority: 23 },
  { keywords: ['astar', 'yapimi'], poz_kodu: 'F-07', priority: 24 },
  { keywords: ['sac', 'yagli', 'boya'], poz_kodu: 'F-07', priority: 25 },
  { keywords: ['yer', 'yagli', 'boya'], poz_kodu: 'F-07', priority: 26 },
  { keywords: ['dograma', 'yagli', 'boya'], poz_kodu: 'F-14', priority: 27 },
  { keywords: ['dograma', 'yag', 'boya'], poz_kodu: 'F-14', priority: 28 },
  { keywords: ['korkuluk', 'yagli', 'boya'], poz_kodu: 'F-12', priority: 29 },
  { keywords: ['korkuluk', 'boya'], poz_kodu: 'F-12', priority: 30 },
  { keywords: ['dis', 'cephe', 'boya'], poz_kodu: 'F-06', priority: 31 },
  { keywords: ['alci', 'tamir'], poz_kodu: 'E-03', priority: 32 },
  { keywords: ['alci', 'siva'], poz_kodu: 'E-03', priority: 33 },
  { keywords: ['siva', 'tamir'], exclude_keywords: ['alci'], poz_kodu: 'E-01', priority: 34 },
  { keywords: ['siva', 'yapil'], exclude_keywords: ['alci'], poz_kodu: 'E-01', priority: 35 },
  { keywords: ['sivanma'], poz_kodu: 'E-01', priority: 36 },
  { keywords: ['kaba', 'siva'], poz_kodu: 'E-01', priority: 37 },
  { keywords: ['saten', 'cekil'], poz_kodu: 'E-04', priority: 38 },
  { keywords: ['alcipan', 'tamir'], poz_kodu: 'G-29', priority: 39 },
  { keywords: ['alcipan', 'macun'], poz_kodu: 'G-29', priority: 40 },
  { keywords: ['alcipan', 'duvar'], poz_kodu: 'G-29', priority: 41 },
  { keywords: ['sap', 'atim'], poz_kodu: 'B-01', priority: 42 },
  { keywords: ['sap', 'yapil'], poz_kodu: 'B-01', priority: 43 },
  { keywords: ['sap', 'dokul'], poz_kodu: 'B-01', priority: 44 },
  { keywords: ['60x60', 'granit'], poz_kodu: 'I-01', priority: 45 },
  { keywords: ['45x45', 'fayans'], poz_kodu: 'I-01', priority: 46 },
  { keywords: ['seramik', 'zemin'], poz_kodu: 'I-01', priority: 47 },
  { keywords: ['yer', 'seramik'], poz_kodu: 'I-01', priority: 48 },
  { keywords: ['30x60', 'fayans'], poz_kodu: 'I-01', priority: 49 },
  { keywords: ['fayans', 'yapimi'], exclude_keywords: ['kirim', 'moloz'], poz_kodu: 'I-01', priority: 50 },
  { keywords: ['seramik', 'duvar'], poz_kodu: 'I-02', priority: 51 },
  { keywords: ['fisek', 'surgu'], poz_kodu: 'K-15', priority: 52 },
  { keywords: ['kapi', 'firca'], poz_kodu: 'L-16', priority: 53 },
  { keywords: ['hidrolik', 'pompa', 'degis'], poz_kodu: 'K-10', priority: 54 },
  { keywords: ['hidrolik', 'takil'], poz_kodu: 'K-10', priority: 55 },
  { keywords: ['hidrolik', 'degis'], exclude_keywords: ['ayar', 'tamir', 'bakim'], poz_kodu: 'K-10', priority: 56 },
  { keywords: ['panik', 'bar'], poz_kodu: 'K-12', priority: 57 },
  { keywords: ['panik', 'kol'], poz_kodu: 'K-12', priority: 58 },
  { keywords: ['asma', 'tavan', 'tamir'], poz_kodu: 'H-01', priority: 59 },
  { keywords: ['asma', 'tavan', 'yapim'], poz_kodu: 'H-01', priority: 60 },
  { keywords: ['coken', 'asma', 'tavan'], poz_kodu: 'H-01', priority: 61 },
  { keywords: ['aski', 'takviye'], poz_kodu: 'H-01', priority: 62 },
  { keywords: ['tasiyici', 'degis'], poz_kodu: 'H-01', priority: 63 },
  { keywords: ['plaka', 'degis'], poz_kodu: 'H-14', priority: 64 },
  { keywords: ['plaka', 'montaj'], poz_kodu: 'H-14', priority: 65 },
  { keywords: ['karolem'], poz_kodu: 'H-14', priority: 66 },
  { keywords: ['alcipan', 'tavan'], poz_kodu: 'H-04', priority: 67 },
  { keywords: ['alcipan', 'kaplama'], poz_kodu: 'H-04', priority: 68 },
  { keywords: ['batarya', 'degis'], poz_kodu: 'O-35', priority: 69 },
  { keywords: ['musluk', 'degis'], poz_kodu: 'O-35', priority: 70 },
  { keywords: ['tesisat', 'iscilik'], poz_kodu: 'O-50', priority: 71 },
  { keywords: ['ic', 'takim', 'degis'], poz_kodu: 'O-13', priority: 72 },
  { keywords: ['tahret', 'vana'], poz_kodu: 'O-05', priority: 73 },
  { keywords: ['tahret', 'musluk'], poz_kodu: 'O-05', priority: 74 },
  { keywords: ['baklavali', 'sac'], poz_kodu: 'D-03', priority: 75 },
  { keywords: ['baklava', 'sac'], poz_kodu: 'D-03', priority: 76 },
  { keywords: ['sac', 'kaplan'], exclude_keywords: ['baklavali', 'baklava'], poz_kodu: 'D-07', priority: 77 },
  { keywords: ['kilit', 'dil', 'karsilik', 'ayar'], poz_kodu: 'K-18', priority: 78 },
  { keywords: ['yikim', 'kirim'], poz_kodu: 'A-01', priority: 79 },
  { keywords: ['kirim', 'sokum'], poz_kodu: 'A-01', priority: 80 },
  { keywords: ['moloz', 'atim'], exclude_keywords: ['fayans'], poz_kodu: 'A-01', priority: 81 },
  { keywords: ['tavan', 'sokum'], poz_kodu: 'A-05', priority: 82 },
  { keywords: ['celik', 'imalat'], poz_kodu: 'N-01', priority: 83 },
  { keywords: ['celik', 'karkas'], poz_kodu: 'N-01', priority: 84 },
  { keywords: ['profil', 'mm'], poz_kodu: 'N-08', priority: 85 },
  { keywords: ['lavabo'], exclude_keywords: ['batarya', 'musluk'], poz_kodu: 'O-01', priority: 86 },
  { keywords: ['iskele'], poz_kodu: 'R-01', priority: 87 },
  { keywords: ['sevk', 'nakliye'], poz_kodu: 'S-03', priority: 88 },
  // S-09 kurallari
  { keywords: ['kopuk', 'izalasyon'], poz_kodu: 'S-09', priority: 900 },
  { keywords: ['kopuk', 'izolasyon'], poz_kodu: 'S-09', priority: 901 },
  { keywords: ['kopuk', 'sikil'], poz_kodu: 'S-09', priority: 902 },
  { keywords: ['kopuk'], poz_kodu: 'S-09', priority: 903 },
  { keywords: ['kapisi', 'yagli', 'boya'], poz_kodu: 'S-09', priority: 904 },
  { keywords: ['kapisi', 'boya'], poz_kodu: 'S-09', priority: 905 },
  { keywords: ['rampa', 'yagli', 'boya'], poz_kodu: 'S-09', priority: 906 },
  { keywords: ['rampa', 'boya'], poz_kodu: 'S-09', priority: 907 },
  { keywords: ['kafes', 'yagli', 'boya'], poz_kodu: 'S-09', priority: 908 },
  { keywords: ['kafes', 'boya'], poz_kodu: 'S-09', priority: 909 },
  { keywords: ['asansor', 'yagli', 'boya'], poz_kodu: 'S-09', priority: 910 },
  { keywords: ['pano', 'yagli', 'boya'], poz_kodu: 'S-09', priority: 911 },
  { keywords: ['platform', 'boya'], poz_kodu: 'S-09', priority: 912 },
  { keywords: ['silikon', 'izalasyon'], poz_kodu: 'S-09', priority: 913 },
  { keywords: ['silikon', 'izolasyon'], poz_kodu: 'S-09', priority: 914 },
  { keywords: ['silikon'], poz_kodu: 'S-09', priority: 915 },
  { keywords: ['dograma', 'tamir'], poz_kodu: 'S-09', priority: 916 },
  { keywords: ['dograma', 'bakim'], poz_kodu: 'S-09', priority: 917 },
  { keywords: ['kapi', 'kanat', 'tamir'], poz_kodu: 'S-09', priority: 918 },
  { keywords: ['kapi', 'ayar'], exclude_keywords: ['hidrolik', 'pompa'], poz_kodu: 'S-09', priority: 919 },
  { keywords: ['mentese'], poz_kodu: 'S-09', priority: 920 },
  { keywords: ['kapiya', 'ayar'], poz_kodu: 'S-09', priority: 921 },
  { keywords: ['yagmur', 'gider'], poz_kodu: 'S-09', priority: 922 },
  { keywords: ['yagmur', 'oluk'], poz_kodu: 'S-09', priority: 923 },
  { keywords: ['yagmur', 'dere'], poz_kodu: 'S-09', priority: 924 },
  { keywords: ['tikaniklik'], poz_kodu: 'S-09', priority: 925 },
  { keywords: ['tikanik'], poz_kodu: 'S-09', priority: 926 },
  { keywords: ['tikali', 'gider'], poz_kodu: 'S-09', priority: 927 },
  { keywords: ['gider', 'acil'], poz_kodu: 'S-09', priority: 928 },
  { keywords: ['gider', 'tikanik'], poz_kodu: 'S-09', priority: 929 },
  { keywords: ['temizlik'], poz_kodu: 'S-09', priority: 930 },
  { keywords: ['temizl'], poz_kodu: 'S-09', priority: 931 },
  { keywords: ['cop', 'atil'], poz_kodu: 'S-09', priority: 932 },
  { keywords: ['hisir', 'ortu'], poz_kodu: 'S-09', priority: 933 },
  { keywords: ['derz', 'tamir'], poz_kodu: 'S-09', priority: 934 },
  { keywords: ['derz', 'dolgu'], poz_kodu: 'S-09', priority: 935 },
  { keywords: ['fayans', 'kirim'], poz_kodu: 'S-09', priority: 936 },
  { keywords: ['zemin', 'fayans', 'kirim'], poz_kodu: 'S-09', priority: 937 },
  { keywords: ['vida', 'dubel'], poz_kodu: 'S-09', priority: 938 },
  { keywords: ['vida'], poz_kodu: 'S-09', priority: 939 },
  { keywords: ['tamir', 'bakim'], poz_kodu: 'S-09', priority: 940 },
  { keywords: ['bakim', 'onarim'], poz_kodu: 'S-09', priority: 941 },
  { keywords: ['tamir', 'tadilat'], poz_kodu: 'S-09', priority: 942 },
  { keywords: ['tamir'], poz_kodu: 'S-09', priority: 943 },
  { keywords: ['cati', 'temiz'], poz_kodu: 'S-09', priority: 944 },
  { keywords: ['oluk', 'temiz'], poz_kodu: 'S-09', priority: 945 },
  { keywords: ['robot', 'makina'], poz_kodu: 'S-09', priority: 946 },
  { keywords: ['zincir', 'gonder'], poz_kodu: 'S-09', priority: 947 },
  { keywords: ['demontaj', 'montaj'], exclude_keywords: ['alcipan'], poz_kodu: 'S-09', priority: 948 },
  { keywords: ['hasere'], poz_kodu: 'S-09', priority: 949 },
  { keywords: ['dayson'], poz_kodu: 'S-09', priority: 950 },
  { keywords: ['ceteal'], poz_kodu: 'S-09', priority: 951 },
  { keywords: ['cete', 'ali'], poz_kodu: 'S-09', priority: 952 },
  { keywords: ['logar'], poz_kodu: 'S-09', priority: 953 },
  { keywords: ['evye'], poz_kodu: 'S-09', priority: 954 },
]
