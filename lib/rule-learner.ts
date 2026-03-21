/**
 * Excel verisinden otomatik POZ eslestirme kurali ogrenen motor
 * Sabit algoritma + degisen veri (VBA makro mantigi)
 */

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

// Anlamsiz kelimeleri filtrele
const STOP_WORDS = new Set([
  've', 'ile', 'icin', 'bir', 'bu', 'su', 'o', 'da', 'de', 'den', 'dan',
  'nin', 'nun', 'ler', 'lar', 'dir', 'dır', 'olan', 'olan', 'gibi',
  'adet', 'mt', 'mtul', 'm2', 'm3', 'kg', 'km', 'mm', 'cm',
  'yapildi', 'yapilmasi', 'yapimi', 'edildi', 'edilmesi',
  'tum', 'her', 'cok', 'bircok', 'alan',
])

// Sayi iceren kelimeleri filtrele
function isNumeric(word: string): boolean {
  return /^\d+$/.test(word) || /^\d+x\d+$/.test(word) || /^\d+m\d*$/.test(word)
}

export interface DataEntry {
  aciklama: string
  poz_kodu: string
}

export interface ProposedRule {
  keywords: string[]
  exclude_keywords: string[] | null
  poz_kodu: string
  priority: number
  confidence: number
  example_aciklama: string
  match_count: number
  precision: number
}

export interface LearnResult {
  proposed_rules: ProposedRule[]
  conflicts: Array<{
    proposed: ProposedRule
    conflicting_poz: string
    conflicting_count: number
  }>
  stats: {
    total_entries: number
    unique_poz_codes: number
    new_rules: number
    skipped_s09: number
  }
}

/**
 * Veri setinden kural ogrenme motoru
 * Algoritma:
 * 1. POZ koduna gore grupla
 * 2. Her gruptaki aciklamalarin tokenlerini frekans analizi yap
 * 3. Yuksek frekanslı keyword kombinasyonlari olustur
 * 4. Tum veri setine karsi dogrula (precision kontrolu)
 * 5. False-positive'ler icin exclude keyword cikar
 */
export function learnRules(entries: DataEntry[]): LearnResult {
  // S-07, S-08 filtrele (otomatik eklenen)
  const filtered = entries.filter(e =>
    e.poz_kodu && e.aciklama &&
    e.poz_kodu !== 'S-07' && e.poz_kodu !== 'S-08' &&
    e.poz_kodu !== 'POZ KODU' // header satiri
  )

  // POZ koduna gore grupla
  const groups: Record<string, string[]> = {}
  for (const entry of filtered) {
    if (!groups[entry.poz_kodu]) groups[entry.poz_kodu] = []
    groups[entry.poz_kodu].push(normalize(entry.aciklama))
  }

  const proposedRules: ProposedRule[] = []
  const conflicts: LearnResult['conflicts'] = []
  let skippedS09 = 0

  // S-09 haric her POZ kodu icin kurallar cikar
  for (const [pozKodu, descriptions] of Object.entries(groups)) {
    if (pozKodu === 'S-09') {
      skippedS09 = descriptions.length
      continue // S-09 fallback, kural olusturmaya gerek yok
    }

    // Tum aciklamalari tokenize et
    const allTokens: Record<string, number> = {}
    const tokenSets: string[][] = descriptions.map(desc => {
      const tokens = desc.split(/\s+/)
        .map(t => t.replace(/[^a-z0-9]/g, ''))
        .filter(t => t.length > 2 && !STOP_WORDS.has(t) && !isNumeric(t))
      tokens.forEach(t => { allTokens[t] = (allTokens[t] || 0) + 1 })
      return tokens
    })

    // Kelimeleri frekansa gore sirala
    const totalDescs = descriptions.length
    const frequentTokens = Object.entries(allTokens)
      .filter(([, count]) => count / totalDescs >= 0.5) // %50+ gorunme
      .sort((a, b) => b[1] - a[1])
      .map(([token]) => token)

    if (frequentTokens.length === 0) continue

    // 1-3 keyword kombinasyonlari olustur
    const candidateRules: Array<{ keywords: string[], matchCount: number }> = []

    // Tek keyword
    for (const kw of frequentTokens.slice(0, 5)) {
      const matchCount = tokenSets.filter(tokens => tokens.includes(kw)).length
      if (matchCount >= 2) {
        candidateRules.push({ keywords: [kw], matchCount })
      }
    }

    // Cift keyword
    for (let i = 0; i < Math.min(frequentTokens.length, 5); i++) {
      for (let j = i + 1; j < Math.min(frequentTokens.length, 5); j++) {
        const kw1 = frequentTokens[i]
        const kw2 = frequentTokens[j]
        const matchCount = tokenSets.filter(tokens =>
          tokens.includes(kw1) && tokens.includes(kw2)
        ).length
        if (matchCount >= 2) {
          candidateRules.push({ keywords: [kw1, kw2], matchCount })
        }
      }
    }

    // En iyi kurali sec: en cok match eden, en az false-positive
    let bestRule: ProposedRule | null = null
    let bestScore = -1

    for (const candidate of candidateRules) {
      // Tum veri setine karsi dogrula
      let truePositive = 0
      let falsePositive = 0
      const falsePositivePozCodes: Record<string, number> = {}

      for (const entry of filtered) {
        const norm = normalize(entry.aciklama)
        const matches = candidate.keywords.every(kw => norm.includes(kw))
        if (matches) {
          if (entry.poz_kodu === pozKodu) {
            truePositive++
          } else {
            falsePositive++
            falsePositivePozCodes[entry.poz_kodu] = (falsePositivePozCodes[entry.poz_kodu] || 0) + 1
          }
        }
      }

      const total = truePositive + falsePositive
      if (total === 0) continue
      const precision = truePositive / total

      // Score: precision * coverage
      const coverage = truePositive / descriptions.length
      const score = precision * coverage

      if (score > bestScore && precision >= 0.7) {
        bestScore = score

        // False positive'ler icin exclude keyword bul
        let excludeKeywords: string[] | null = null
        if (falsePositive > 0 && precision < 0.9) {
          // False positive aciklamalarindaki farkli kelimeleri bul
          const fpDescriptions = filtered
            .filter(e => {
              const norm = normalize(e.aciklama)
              return candidate.keywords.every(kw => norm.includes(kw)) && e.poz_kodu !== pozKodu
            })
            .map(e => normalize(e.aciklama))

          const fpTokens: Record<string, number> = {}
          fpDescriptions.forEach(desc => {
            desc.split(/\s+/)
              .filter(t => t.length > 2 && !STOP_WORDS.has(t) && !candidate.keywords.includes(t))
              .forEach(t => { fpTokens[t] = (fpTokens[t] || 0) + 1 })
          })

          // En sik gorunen, true positive'lerde az gorunen kelimeleri exclude yap
          const tpTokens: Record<string, number> = {}
          descriptions.forEach(desc => {
            desc.split(/\s+/)
              .filter(t => t.length > 2)
              .forEach(t => { tpTokens[t] = (tpTokens[t] || 0) + 1 })
          })

          excludeKeywords = Object.entries(fpTokens)
            .filter(([token, count]) => count >= fpDescriptions.length * 0.5 && (tpTokens[token] || 0) < descriptions.length * 0.2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([token]) => token)

          if (excludeKeywords.length === 0) excludeKeywords = null
        }

        bestRule = {
          keywords: candidate.keywords,
          exclude_keywords: excludeKeywords,
          poz_kodu: pozKodu,
          priority: candidate.keywords.length >= 3 ? 50 : candidate.keywords.length >= 2 ? 100 : 200,
          confidence: precision * 100,
          example_aciklama: descriptions[0] || '',
          match_count: truePositive,
          precision: Math.round(precision * 100),
        }

        // Catisma varsa kaydet
        if (falsePositive > 0) {
          for (const [fpPoz, fpCount] of Object.entries(falsePositivePozCodes)) {
            conflicts.push({
              proposed: bestRule,
              conflicting_poz: fpPoz,
              conflicting_count: fpCount,
            })
          }
        }
      }
    }

    if (bestRule) {
      proposedRules.push(bestRule)
    }
  }

  // Priority'ye gore sirala
  proposedRules.sort((a, b) => a.priority - b.priority)

  return {
    proposed_rules: proposedRules,
    conflicts,
    stats: {
      total_entries: filtered.length,
      unique_poz_codes: Object.keys(groups).length,
      new_rules: proposedRules.length,
      skipped_s09: skippedS09,
    },
  }
}

/**
 * Mevcut kurallari bilinen veri setine karsi test et
 */
export interface TestResult {
  total: number
  correct: number
  incorrect: number
  accuracy: number
  mismatches: Array<{
    aciklama: string
    expected: string
    got: string
  }>
}

export async function testRules(
  entries: DataEntry[],
  matchFn: (aciklama: string) => Promise<string>
): Promise<TestResult> {
  const filtered = entries.filter(e =>
    e.poz_kodu && e.aciklama &&
    e.poz_kodu !== 'S-07' && e.poz_kodu !== 'S-08' &&
    e.poz_kodu !== 'POZ KODU'
  )

  let correct = 0
  let incorrect = 0
  const mismatches: TestResult['mismatches'] = []

  for (const entry of filtered) {
    const got = await matchFn(entry.aciklama)
    if (got === entry.poz_kodu) {
      correct++
    } else {
      incorrect++
      mismatches.push({
        aciklama: entry.aciklama,
        expected: entry.poz_kodu,
        got,
      })
    }
  }

  const total = correct + incorrect

  return {
    total,
    correct,
    incorrect,
    accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    mismatches: mismatches.slice(0, 50), // Ilk 50 hatayi goster
  }
}
