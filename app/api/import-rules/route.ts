import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { learnRules, type DataEntry } from '@/lib/rule-learner'
import * as XLSX from 'xlsx'

// POST: Excel'den kural ogren (onizleme)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const action = formData.get('action') as string // 'preview' veya 'confirm'

    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadi' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(bytes)

    // Veri cikart: aciklama + poz_kodu sutunlarini bul
    const entries: DataEntry[] = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown as unknown[][]

      if (!data || data.length < 3) continue

      // Header satırını bul (POZ KODU iceren satir)
      let pozKoduCol = -1
      let aciklamaCol = -1
      let headerRow = -1

      for (let row = 0; row < Math.min(data.length, 5); row++) {
        const cells = data[row]
        if (!cells) continue
        for (let col = 0; col < cells.length; col++) {
          const val = String(cells[col] || '').toUpperCase().trim()
          if (val === 'POZ KODU' || val === 'POZ\nKODU') {
            pozKoduCol = col
            headerRow = row
          }
          if (val === 'AÇIKLAMA' || val === 'ACIKLAMA') {
            aciklamaCol = col
          }
        }
      }

      if (pozKoduCol === -1 || aciklamaCol === -1) continue

      // Veri satirlarini oku
      for (let row = headerRow + 1; row < data.length; row++) {
        const cells = data[row]
        if (!cells) continue

        const pozKodu = String(cells[pozKoduCol] || '').trim()
        const aciklama = String(cells[aciklamaCol] || '').trim()

        // POZ kodu formatini kontrol et (X-NN)
        if (pozKodu && aciklama && /^[A-Z]-\d+$/.test(pozKodu)) {
          entries.push({ aciklama, poz_kodu: pozKodu })
        }
      }
    }

    if (entries.length === 0) {
      return NextResponse.json({
        error: 'Excel dosyasinda POZ KODU ve AÇIKLAMA sutunlari bulunamadi',
      }, { status: 400 })
    }

    // Kural ogrenme motorunu calistir
    const result = learnRules(entries)

    // Confirm islemi: onerilen kurallari kaydet
    if (action === 'confirm') {
      const supabase = getSupabaseAdmin()
      const rulesToInsert = result.proposed_rules.map(rule => ({
        keywords: rule.keywords,
        exclude_keywords: rule.exclude_keywords,
        poz_kodu: rule.poz_kodu,
        priority: rule.priority,
        source: 'learned',
        example_aciklama: rule.example_aciklama,
        is_active: true,
      }))

      if (rulesToInsert.length > 0) {
        const { error } = await supabase
          .from('poz_match_rules')
          .insert(rulesToInsert)

        if (error) throw error
      }

      return NextResponse.json({
        success: true,
        message: `${rulesToInsert.length} kural kaydedildi`,
        stats: result.stats,
      })
    }

    // Default: onizleme dondur
    return NextResponse.json({
      proposed_rules: result.proposed_rules,
      conflicts: result.conflicts,
      stats: result.stats,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
