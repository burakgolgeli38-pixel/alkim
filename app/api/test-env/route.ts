import { NextResponse } from 'next/server'

export async function GET() {
  const keys = Object.keys(process.env).filter(k => k.includes('ANTHROPIC') || k.includes('SUPABASE'))
  return NextResponse.json({
    found_keys: keys,
    anthropic_set: !!process.env.ANTHROPIC_API_KEY,
    anthropic_length: process.env.ANTHROPIC_API_KEY?.length ?? 'undefined',
    all_env_count: Object.keys(process.env).length,
  })
}
