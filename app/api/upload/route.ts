import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

    // Claude Vision ile OCR
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Bu bir ALKIM şirketine ait Tutanak Formu görseli. Formdaki bilgileri JSON olarak çıkar.
Sadece JSON döndür, başka hiçbir şey yazma.

Format:
{
  "no": "tutanak numarası",
  "tarih": "GG.AA.YYYY formatında tarih",
  "mudahale_tarihi": "müdahale ediliş tarihi",
  "bolge": "bölge ismi",
  "magaza": "mağaza ismi",
  "adres": "adres bilgisi",
  "cagri_no": "çağrı no",
  "konu": "konu",
  "aciklama": "konu hakkında açıklamalar",
  "firma_sorumlusu": "mimari firma sorumlusu adı",
  "sorumlu": "sorumlu kişi adı"
}

Okunamayan alanlar için boş string kullan.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('OCR sonucu parse edilemedi')

    const extracted = JSON.parse(jsonMatch[0])

    // Görseli Supabase Storage'a yükle
    const fileName = `tutanak_${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tutanaklar')
      .upload(fileName, buffer, { contentType: file.type })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('tutanaklar')
      .getPublicUrl(fileName)

    // DB'ye kaydet
    const { data, error } = await supabase
      .from('tutanaklar')
      .insert({ ...extracted, gorsel_url: publicUrl })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, tutanak: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
