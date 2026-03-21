import { NextRequest, NextResponse } from 'next/server'
import { matchPozKodu } from '@/lib/poz-matcher'
import { testRules, type DataEntry } from '@/lib/rule-learner'
import * as XLSX from 'xlsx'

// POST: Kurallari bilinen veri setine karsi test et
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadi' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(bytes)

    // Veri cikart
    const entries: DataEntry[] = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown as unknown[][]

      if (!data || data.length < 3) continue

      // Header satirini bul
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

      for (let row = headerRow + 1; row < data.length; row++) {
        const cells = data[row]
        if (!cells) continue

        const pozKodu = String(cells[pozKoduCol] || '').trim()
        const aciklama = String(cells[aciklamaCol] || '').trim()

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

    // Test et
    const result = await testRules(entries, matchPozKodu)

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
