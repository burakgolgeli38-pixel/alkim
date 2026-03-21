import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET: Tum kurallari listele
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const poz_kodu = searchParams.get('poz_kodu')
    const source = searchParams.get('source')
    const active = searchParams.get('active')

    let query = supabase
      .from('poz_match_rules')
      .select('*')
      .order('priority', { ascending: true })

    if (poz_kodu) query = query.eq('poz_kodu', poz_kodu)
    if (source) query = query.eq('source', source)
    if (active !== null && active !== undefined) query = query.eq('is_active', active === 'true')

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ rules: data, count: data?.length || 0 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Turkce karakter normalize (keyword icin)
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
    .trim()
}

// POST: Yeni kural ekle
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()
    const { keywords, exclude_keywords, poz_kodu, priority, example_aciklama } = body

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords dizisi gerekli' }, { status: 400 })
    }
    if (!poz_kodu) {
      return NextResponse.json({ error: 'poz_kodu gerekli' }, { status: 400 })
    }

    const normalizedKeywords = keywords.map((k: string) => normalize(k))
    const normalizedExclude = exclude_keywords?.map((k: string) => normalize(k)) || null

    const { data, error } = await supabase
      .from('poz_match_rules')
      .insert({
        keywords: normalizedKeywords,
        exclude_keywords: normalizedExclude,
        poz_kodu: poz_kodu.toUpperCase(),
        priority: priority || 100,
        source: 'manual',
        example_aciklama: example_aciklama || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, rule: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: Kural guncelle
export async function PUT(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()
    const { id, keywords, exclude_keywords, poz_kodu, priority, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (keywords) updateData.keywords = keywords.map((k: string) => normalize(k))
    if (exclude_keywords !== undefined) updateData.exclude_keywords = exclude_keywords?.map((k: string) => normalize(k)) || null
    if (poz_kodu) updateData.poz_kodu = poz_kodu.toUpperCase()
    if (priority !== undefined) updateData.priority = priority
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabase
      .from('poz_match_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, rule: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Kural sil
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
    }

    const { error } = await supabase
      .from('poz_match_rules')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
