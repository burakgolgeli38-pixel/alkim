import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('tutanaklar')
    .select('*')
    .order('tarih', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []).map((t) => ({
    'Tutanak No': t.no,
    'Tarih': t.tarih,
    'Müdahale Tarihi': t.mudahale_tarihi,
    'Bölge': t.bolge,
    'Mağaza': t.magaza,
    'Adres': t.adres,
    'Çağrı No': t.cagri_no,
    'Konu': t.konu,
    'Açıklama': t.aciklama,
    'Firma Sorumlusu': t.firma_sorumlusu,
    'Sorumlu': t.sorumlu,
    'Görsel URL': t.gorsel_url,
    'Yüklenme Tarihi': new Date(t.created_at).toLocaleString('tr-TR'),
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Sütun genişlikleri
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 20 },
    { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 50 }, { wch: 20 },
    { wch: 20 }, { wch: 40 }, { wch: 18 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Tutanaklar')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tutanaklar_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
