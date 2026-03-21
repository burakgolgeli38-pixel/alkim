import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('tutanaklar')
    .select('*, tutanak_items(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    // Once is kalemlerini sil
    const { error: itemsError } = await supabase
      .from('tutanak_items')
      .delete()
      .eq('tutanak_id', id)

    if (itemsError) throw itemsError

    // Sonra tutanagi sil
    const { error: tutanakError } = await supabase
      .from('tutanaklar')
      .delete()
      .eq('id', id)

    if (tutanakError) throw tutanakError

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
