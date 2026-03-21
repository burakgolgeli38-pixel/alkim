import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET: Tum gruplari listele
export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('uygulamaci_groups')
      .select('*')
      .order('group_name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ groups: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: Yeni grup ekle
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { group_name, members } = await req.json()

    if (!group_name || !members || !Array.isArray(members)) {
      return NextResponse.json({ error: 'group_name ve members dizisi gerekli' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('uygulamaci_groups')
      .insert({
        group_name: group_name.toUpperCase().trim(),
        members: members.map((m: string) => m.trim()),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, group: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: Grup guncelle
export async function PUT(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { id, group_name, members, is_active } = await req.json()

    if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (group_name) updateData.group_name = group_name.toUpperCase().trim()
    if (members) updateData.members = members.map((m: string) => m.trim())
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabase
      .from('uygulamaci_groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, group: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Grup sil
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

    const { error } = await supabase
      .from('uygulamaci_groups')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
