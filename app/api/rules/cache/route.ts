import { NextResponse } from 'next/server'
import { clearRuleCache } from '@/lib/poz-matcher'

// POST: Cache'i temizle (kural degisikligi sonrasi)
export async function POST() {
  clearRuleCache()
  return NextResponse.json({ success: true, message: 'Kural cache temizlendi' })
}
