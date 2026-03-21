/**
 * Mevcut hardcoded RULES dizisini Supabase poz_match_rules tablosuna migrate eder.
 * Tek seferlik calistirilir: npx tsx scripts/migrate-rules-to-supabase.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// .env.local dosyasini yukle
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface MigrationRule {
  keywords: string[]
  exclude?: string[]
  poz: string
  example?: string
}

// Mevcut poz-matcher.ts'den birebir kopyalanan kurallar
const RULES: MigrationRule[] = [
  // C-07: SURME IZOLASYON (14 kullanim)
  { keywords: ['surme', 'izalasyon'], poz: 'C-07', example: 'SÜRME İZALASYON 40M' },
  { keywords: ['surme', 'izolasyon'], poz: 'C-07', example: 'SÜRME İZOLASYON 30 M' },
  { keywords: ['cati', 'izalasyon'], exclude: ['temiz', 'cop'], poz: 'C-07', example: 'ÇATI İZALASYON 15M' },
  { keywords: ['cati', 'izolasyon'], exclude: ['temiz', 'cop'], poz: 'C-07', example: 'ÇATI İZOLASYON' },

  // C-06: LIKIT SURME SU IZOLASYONU
  { keywords: ['likit', 'izolasyon'], poz: 'C-06' },
  { keywords: ['likit', 'izalasyon'], poz: 'C-06' },
  { keywords: ['likit', 'surme'], poz: 'C-06' },

  // C-08: PUSKURTME IZOLASYON
  { keywords: ['puskurtme', 'izolasyon'], poz: 'C-08' },
  { keywords: ['puskurtme', 'izalasyon'], poz: 'C-08' },

  // C-09: MEMBRAN
  { keywords: ['membran'], poz: 'C-09' },

  // F-03: PLASTIK BOYA (14 kullanim)
  { keywords: ['plastik', 'boya'], poz: 'F-03', example: 'PLASTİK BOYA 140M2' },
  { keywords: ['tavan', 'boya'], exclude: ['yagli', 'yag', 'asma', 'sokum'], poz: 'F-03', example: 'TAVAN BOYANMASI 440M2' },

  // F-07: YAGLI BOYA / ASTAR (12 kullanim)
  { keywords: ['nem', 'astar'], poz: 'F-07', example: 'NEM ASTARI YAPIMI 35M' },
  { keywords: ['is', 'astar'], poz: 'F-07', example: 'İS ASTARI 40M2' },
  { keywords: ['astar', 'yapimi'], poz: 'F-07' },
  { keywords: ['sac', 'yagli', 'boya'], poz: 'F-07', example: 'YER SACLARI YAĞLI BOYA 20M2' },
  { keywords: ['yer', 'yagli', 'boya'], poz: 'F-07' },

  // F-14: DOGRAMA YAGLI BOYA (11 kullanim)
  { keywords: ['dograma', 'yagli', 'boya'], poz: 'F-14', example: 'DOĞRAMALAR YAĞLI BOYA 70M' },
  { keywords: ['dograma', 'yag', 'boya'], poz: 'F-14' },

  // F-12: KORKULUK/DEMIR YAGLI BOYA (7 kullanim)
  { keywords: ['korkuluk', 'yagli', 'boya'], poz: 'F-12', example: 'KORKULUKLAR YAĞLI BOYA 30MT' },
  { keywords: ['korkuluk', 'boya'], poz: 'F-12' },

  // F-06: DIS CEPHE BOYA (3 kullanim)
  { keywords: ['dis', 'cephe', 'boya'], poz: 'F-06', example: 'DIŞ CEPHE BOYA 20M2' },

  // E-03: ALCI SIVA/TAMIR (11 kullanim)
  { keywords: ['alci', 'tamir'], poz: 'E-03', example: 'ALÇI TAMİRLERİ BİRÇOKYER' },
  { keywords: ['alci', 'siva'], poz: 'E-03' },

  // E-01: KABA SIVA (5 kullanim)
  { keywords: ['siva', 'tamir'], exclude: ['alci'], poz: 'E-01', example: 'DIŞ CEPHE SIVA TAMİRLERİ' },
  { keywords: ['siva', 'yapil'], exclude: ['alci'], poz: 'E-01' },
  { keywords: ['sivanma'], poz: 'E-01' },
  { keywords: ['kaba', 'siva'], poz: 'E-01' },

  // E-04: SATEN
  { keywords: ['saten', 'cekil'], poz: 'E-04', example: 'SATEN ÇEKİLMESİ' },

  // G-29: ALCIPAN (8 kullanim)
  { keywords: ['alcipan', 'tamir'], poz: 'G-29', example: 'ALÇIPAN TAMİRLERİ VE MACUNLU BOYA' },
  { keywords: ['alcipan', 'macun'], poz: 'G-29' },
  { keywords: ['alcipan', 'duvar'], poz: 'G-29' },

  // B-01: SAP (7 kullanim)
  { keywords: ['sap', 'atim'], poz: 'B-01', example: 'ALT DOLGU İÇİN ŞAP ATIMI' },
  { keywords: ['sap', 'yapil'], poz: 'B-01' },
  { keywords: ['sap', 'dokul'], poz: 'B-01' },

  // I-01: ZEMIN SERAMIK/GRANIT (7 kullanim)
  { keywords: ['60x60', 'granit'], poz: 'I-01', example: '60X60 GRANİT YAPIMI 6 ADET' },
  { keywords: ['45x45', 'fayans'], poz: 'I-01' },
  { keywords: ['seramik', 'zemin'], poz: 'I-01' },
  { keywords: ['yer', 'seramik'], poz: 'I-01' },

  // I-01 (30x60 fayans gercek veride I-01)
  { keywords: ['30x60', 'fayans'], poz: 'I-01', example: '30X60 FAYANS YAPIMI 24 ADET' },
  { keywords: ['fayans', 'yapimi'], exclude: ['kirim', 'moloz'], poz: 'I-01' },

  // I-02: DUVAR SERAMIK
  { keywords: ['seramik', 'duvar'], poz: 'I-02' },

  // K-15: FISEK SURGU (12 kullanim)
  { keywords: ['fisek', 'surgu'], poz: 'K-15', example: 'FİŞEK SÜRGÜ DEĞİŞİMİ 3 ADET' },

  // L-16: KAPI ALTI FIRCASI (7 kullanim)
  { keywords: ['kapi', 'firca'], poz: 'L-16', example: 'KAPI ALTI FIRÇASI DEĞİŞİMİ 4 ADET' },

  // K-10: HIDROLIK POMPA (6 kullanim)
  { keywords: ['hidrolik', 'pompa', 'degis'], poz: 'K-10', example: 'HİDROLİK POMPA DEĞİŞİMİ 1 ADET' },
  { keywords: ['hidrolik', 'takil'], poz: 'K-10' },
  { keywords: ['hidrolik', 'degis'], exclude: ['ayar', 'tamir', 'bakim'], poz: 'K-10' },

  // K-12: PANIK BAR (5 kullanim)
  { keywords: ['panik', 'bar'], poz: 'K-12', example: 'PANİK BAR TEMİN MONTAJ' },
  { keywords: ['panik', 'kol'], poz: 'K-12' },

  // H-01: ASMA TAVAN YAPIMI/TAMIR (5 kullanim)
  { keywords: ['asma', 'tavan', 'tamir'], poz: 'H-01', example: 'ÇÖKEN ASMA TAVAN TAMİRLERİ' },
  { keywords: ['asma', 'tavan', 'yapim'], poz: 'H-01' },
  { keywords: ['coken', 'asma', 'tavan'], poz: 'H-01' },
  { keywords: ['aski', 'takviye'], poz: 'H-01' },
  { keywords: ['tasiyici', 'degis'], poz: 'H-01' },

  // H-14: PLAKA DEGISIMI (4 kullanim)
  { keywords: ['plaka', 'degis'], poz: 'H-14', example: 'KAROLEM PLAKA DEĞİŞİMİ 15 ADET' },
  { keywords: ['plaka', 'montaj'], poz: 'H-14' },
  { keywords: ['karolem'], poz: 'H-14' },

  // H-04: ALCIPAN TAVAN
  { keywords: ['alcipan', 'tavan'], poz: 'H-04' },
  { keywords: ['alcipan', 'kaplama'], poz: 'H-04' },

  // O-35: BATARYA/MUSLUK (3 kullanim)
  { keywords: ['batarya', 'degis'], poz: 'O-35' },
  { keywords: ['musluk', 'degis'], poz: 'O-35' },

  // O-50: TESISAT ISCILIK (3 kullanim)
  { keywords: ['tesisat', 'iscilik'], poz: 'O-50' },

  // O-13: KLOZET IC TAKIM
  { keywords: ['ic', 'takim', 'degis'], poz: 'O-13' },

  // O-05: TAHRET
  { keywords: ['tahret', 'vana'], poz: 'O-05' },
  { keywords: ['tahret', 'musluk'], poz: 'O-05' },

  // D-03: BAKLAVALI SAC (3 kullanim)
  { keywords: ['baklavali', 'sac'], poz: 'D-03', example: 'YERE BAKLAVALI SAC KAPLAMA YAPILDI' },
  { keywords: ['baklava', 'sac'], poz: 'D-03' },

  // D-07: SAC KAPLAMA
  { keywords: ['sac', 'kaplan'], exclude: ['baklavali', 'baklava'], poz: 'D-07' },

  // D-01: DEMIR ISLERI
  { keywords: ['demir', 'isler', 'iscilik'], poz: 'D-01' },
  { keywords: ['demir', 'revize'], poz: 'D-01' },

  // K-18: KILIT AYAR
  { keywords: ['kilit', 'dil', 'karsilik', 'ayar'], poz: 'K-18' },

  // A-01: YIKIM KIRIM
  { keywords: ['yikim', 'kirim'], poz: 'A-01' },
  { keywords: ['kirim', 'sokum'], poz: 'A-01' },
  { keywords: ['moloz', 'atim'], exclude: ['fayans'], poz: 'A-01' },

  // A-05: TAVAN SOKUMU
  { keywords: ['tavan', 'sokum'], poz: 'A-05' },

  // N-01: CELIK IMALAT
  { keywords: ['celik', 'imalat'], poz: 'N-01' },
  { keywords: ['celik', 'karkas'], poz: 'N-01' },

  // N-08: PROFIL
  { keywords: ['profil', 'mm'], poz: 'N-08' },

  // O-01: LAVABO
  { keywords: ['lavabo'], exclude: ['batarya', 'musluk'], poz: 'O-01' },

  // R-01: ISKELE
  { keywords: ['iskele'], poz: 'R-01' },

  // S-03: SEVK NAKLIYE
  { keywords: ['sevk', 'nakliye'], poz: 'S-03' },

  // --- S-09 KURALLARI (catch-all, en son) ---

  // Kopuk → S-09
  { keywords: ['kopuk', 'izalasyon'], poz: 'S-09' },
  { keywords: ['kopuk', 'izolasyon'], poz: 'S-09' },
  { keywords: ['kopuk', 'sikil'], poz: 'S-09' },
  { keywords: ['kopuk'], poz: 'S-09' },

  // Yagli boya tek parca → S-09
  { keywords: ['kapisi', 'yagli', 'boya'], poz: 'S-09' },
  { keywords: ['kapisi', 'boya'], poz: 'S-09' },
  { keywords: ['rampa', 'yagli', 'boya'], poz: 'S-09' },
  { keywords: ['rampa', 'boya'], poz: 'S-09' },
  { keywords: ['kafes', 'yagli', 'boya'], poz: 'S-09' },
  { keywords: ['kafes', 'boya'], poz: 'S-09' },
  { keywords: ['asansor', 'yagli', 'boya'], poz: 'S-09' },
  { keywords: ['pano', 'yagli', 'boya'], poz: 'S-09' },
  { keywords: ['platform', 'boya'], poz: 'S-09' },

  // Silikon → S-09
  { keywords: ['silikon', 'izalasyon'], poz: 'S-09' },
  { keywords: ['silikon', 'izolasyon'], poz: 'S-09' },
  { keywords: ['silikon'], poz: 'S-09' },

  // Dograma tamiri → S-09
  { keywords: ['dograma', 'tamir'], poz: 'S-09' },
  { keywords: ['dograma', 'bakim'], poz: 'S-09' },

  // Kapi tamiri/ayar → S-09
  { keywords: ['kapi', 'kanat', 'tamir'], poz: 'S-09' },
  { keywords: ['kapi', 'ayar'], exclude: ['hidrolik', 'pompa'], poz: 'S-09' },
  { keywords: ['mentese'], poz: 'S-09' },
  { keywords: ['kapiya', 'ayar'], poz: 'S-09' },

  // Yagmur/gider/tikaniklik → S-09
  { keywords: ['yagmur', 'gider'], poz: 'S-09' },
  { keywords: ['yagmur', 'oluk'], poz: 'S-09' },
  { keywords: ['yagmur', 'dere'], poz: 'S-09' },
  { keywords: ['tikaniklik'], poz: 'S-09' },
  { keywords: ['tikanik'], poz: 'S-09' },
  { keywords: ['tikali', 'gider'], poz: 'S-09' },
  { keywords: ['gider', 'acil'], poz: 'S-09' },
  { keywords: ['gider', 'tikanik'], poz: 'S-09' },

  // Temizlik → S-09
  { keywords: ['temizlik'], poz: 'S-09' },
  { keywords: ['temizl'], poz: 'S-09' },
  { keywords: ['cop', 'atil'], poz: 'S-09' },
  { keywords: ['hisir', 'ortu'], poz: 'S-09' },

  // Derz → S-09
  { keywords: ['derz', 'tamir'], poz: 'S-09' },
  { keywords: ['derz', 'dolgu'], poz: 'S-09' },

  // Fayans kirimi → S-09
  { keywords: ['fayans', 'kirim'], poz: 'S-09' },
  { keywords: ['zemin', 'fayans', 'kirim'], poz: 'S-09' },

  // Vida/dubel → S-09
  { keywords: ['vida', 'dubel'], poz: 'S-09' },
  { keywords: ['vida'], poz: 'S-09' },

  // Genel tamir/bakim → S-09
  { keywords: ['tamir', 'bakim'], poz: 'S-09' },
  { keywords: ['bakim', 'onarim'], poz: 'S-09' },
  { keywords: ['tamir', 'tadilat'], poz: 'S-09' },
  { keywords: ['tamir'], poz: 'S-09' },

  // Cati temizligi → S-09
  { keywords: ['cati', 'temiz'], poz: 'S-09' },
  { keywords: ['oluk', 'temiz'], poz: 'S-09' },

  // Robot/zincir → S-09
  { keywords: ['robot', 'makina'], poz: 'S-09' },
  { keywords: ['zincir', 'gonder'], poz: 'S-09' },

  // Demontaj/montaj genel → S-09
  { keywords: ['demontaj', 'montaj'], exclude: ['alcipan'], poz: 'S-09' },

  // Diger S-09
  { keywords: ['hasere'], poz: 'S-09' },
  { keywords: ['dayson'], poz: 'S-09' },
  { keywords: ['ceteal'], poz: 'S-09' },
  { keywords: ['cete', 'ali'], poz: 'S-09' },
  { keywords: ['logar'], poz: 'S-09' },
  { keywords: ['evye'], poz: 'S-09' },
]

async function migrate() {
  console.log(`Migrating ${RULES.length} rules to Supabase...`)

  // Once mevcut kurallari sil (temiz baslangic)
  const { error: deleteError } = await supabase
    .from('poz_match_rules')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // delete all

  if (deleteError) {
    console.error('Silme hatasi:', deleteError.message)
    // Tablo henuz olusturulmamis olabilir, devam et
  }

  // Priority hesapla: S-09 olmayan kurallar 10'dan baslar, S-09 kurallar 900'den
  let nonS09Priority = 10
  let s09Priority = 900

  const rows = RULES.map((rule) => {
    const isS09 = rule.poz === 'S-09'
    const priority = isS09 ? s09Priority++ : nonS09Priority++

    return {
      keywords: rule.keywords,
      exclude_keywords: rule.exclude || null,
      poz_kodu: rule.poz,
      priority,
      source: 'migrated',
      example_aciklama: rule.example || null,
      hit_count: 0,
      is_active: true,
    }
  })

  // Batch insert (50'serli)
  const batchSize = 50
  let inserted = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from('poz_match_rules')
      .insert(batch)

    if (error) {
      console.error(`Batch ${i / batchSize + 1} hatasi:`, error.message)
      process.exit(1)
    }
    inserted += batch.length
    console.log(`  ${inserted}/${rows.length} kural eklendi`)
  }

  // Dogrulama
  const { data, error: countError } = await supabase
    .from('poz_match_rules')
    .select('id', { count: 'exact' })

  if (countError) {
    console.error('Dogrulama hatasi:', countError.message)
  } else {
    console.log(`\nMigrasyon tamamlandi! Toplam ${data?.length} kural Supabase'de.`)
  }

  // POZ kodu dagilimi
  const { data: stats } = await supabase
    .from('poz_match_rules')
    .select('poz_kodu')

  if (stats) {
    const counts: Record<string, number> = {}
    stats.forEach((r: { poz_kodu: string }) => {
      counts[r.poz_kodu] = (counts[r.poz_kodu] || 0) + 1
    })
    console.log('\nPOZ kodu dagilimi:')
    Object.entries(counts).sort().forEach(([poz, count]) => {
      console.log(`  ${poz}: ${count} kural`)
    })
  }
}

migrate().catch(console.error)
