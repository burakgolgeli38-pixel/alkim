import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    _supabase = createClient(url, key)
  }
  return _supabase
}

// Geriye dönük uyumluluk için
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export type Tutanak = {
  id: string
  no: string
  tarih: string
  mudahale_tarihi: string
  bolge: string
  magaza: string
  adres: string
  cagri_no: string
  konu: string
  aciklama: string
  firma_sorumlusu: string
  sorumlu: string
  gorsel_url: string
  created_at: string
}
