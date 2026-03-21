'use client'

import { useState, useRef } from 'react'
import { useTheme } from '@/lib/theme-context'
import ThemeToggle from '@/components/ThemeToggle'

export default function CalısanPage() {
  const { colors, isDark } = useTheme()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [durum, setDurum] = useState<'bosta' | 'yukleniyor' | 'basarili' | 'hata'>('bosta')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sonuc, setSonuc] = useState<Record<string, any> | null>(null)
  const [hata, setHata] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setDurum('bosta')
    setSonuc(null)
  }

  async function yukle() {
    if (!file) return
    setDurum('yukleniyor')
    setHata('')

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Hata oluştu')
      setSonuc({ ...json.tutanak, _uyarilar: json.uyarilar, _dogrulama: json.dogrulama_durumu })
      setDurum('basarili')
    } catch (err: unknown) {
      setHata(err instanceof Error ? err.message : 'Bilinmeyen hata')
      setDurum('hata')
    }
  }

  function sifirla() {
    setFile(null)
    setPreview(null)
    setDurum('bosta')
    setSonuc(null)
    setHata('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // Header arka plani: dark modda daha koyu bir ton
  const headerBg = isDark ? '#1E293B' : '#2B3674'

  return (
    <main className="min-h-screen flex flex-col items-center py-8 px-4" style={{ background: colors.pageBg }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="rounded-2xl p-5 mb-6 relative" style={{ background: headerBg }}>
          {/* Theme toggle sag ust */}
          <div className="absolute top-3 right-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: colors.accent }}>A</div>
            <h1 className="text-xl font-bold tracking-wide text-white">ALKIM</h1>
          </div>
          <p className="text-sm mt-1 text-center" style={{ color: 'rgba(255,255,255,0.6)' }}>Tutanak Yukleme</p>
        </div>

        {durum === 'basarili' && sonuc ? (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: colors.cardBg, border: `1px solid ${colors.borderColor}` }}>
            {/* Basari */}
            <div className="flex items-center gap-2 font-semibold text-lg mb-2" style={{ color: colors.green }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: colors.greenBg }}>
                <svg className="w-4 h-4" fill="none" stroke={colors.green} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              Tutanak Kaydedildi
            </div>

            {/* Uyari */}
            {sonuc._dogrulama === 'uyari' && sonuc._uyarilar?.length > 0 && (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: colors.orangeBg, border: `1px solid ${colors.orangeBorder}` }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: colors.orangeBg }}>
                  <svg className="w-3.5 h-3.5" style={{ color: colors.orange }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: colors.orange }}>Dogrulama Uyarisi</p>
                  {sonuc._uyarilar.map((u: string, i: number) => (
                    <p key={i} className="text-xs mt-1" style={{ color: colors.orange }}>{u}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Bilgiler */}
            {[
              ['Tutanak No', sonuc.no],
              ['Tarih', sonuc.tarih],
              ['Bolge', sonuc.bolge],
              ['Magaza', sonuc.magaza],
              ['Konu', sonuc.konu],
              ['Sorumlu', sonuc.sorumlu],
              ['Uygulamaci', sonuc.uygulamaci],
              ['Bolge Mudurlugu', sonuc.bolge_mudurlugu],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm pb-2" style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                <span style={{ color: colors.textMuted }}>{label}</span>
                <span className="font-semibold text-right max-w-[55%]" style={{ color: colors.navy }}>{value || '—'}</span>
              </div>
            ))}

            {/* Is kalemleri */}
            {sonuc.tutanak_items && sonuc.tutanak_items.length > 0 && (
              <div className="pt-2">
                <p className="font-semibold text-sm mb-2" style={{ color: colors.navy }}>Is Kalemleri ({sonuc.tutanak_items.length})</p>
                <div className="space-y-2">
                  {sonuc.tutanak_items.map((item: { poz_kodu: string; aciklama: string; miktar: number; birim: string; toplam_tutar: number }, idx: number) => (
                    <div key={idx} className="rounded-xl p-2.5 text-xs" style={{ background: colors.inputBg, border: `1px solid ${colors.borderColor}` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white px-1.5 py-0.5 rounded-md font-mono font-bold text-[11px]" style={{ background: colors.navyLight }}>{item.poz_kodu}</span>
                        <span style={{ color: colors.textSecondary }}>{item.aciklama}</span>
                      </div>
                      <div className="flex gap-3" style={{ color: colors.textMuted }}>
                        <span>Miktar: <b style={{ color: colors.navy }}>{item.miktar} {item.birim}</b></span>
                        <span className="font-bold" style={{ color: colors.green }}>{item.toplam_tutar?.toLocaleString('tr-TR')} TL</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={sifirla}
              className="w-full mt-4 text-white py-3 rounded-xl font-semibold text-sm transition-transform hover:scale-[1.01]"
              style={{ background: isDark ? colors.accent : '#2B3674' }}
            >
              Yeni Tutanak Yukle
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: colors.cardBg, border: `1px solid ${colors.borderColor}` }}>
            <div
              onClick={() => inputRef.current?.click()}
              className="rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
              style={{ border: `2px dashed ${colors.borderColor}` }}
              onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = colors.borderColor}
            >
              {preview ? (
                <img src={preview} alt="Onizleme" className="mx-auto max-h-64 rounded-lg object-contain" />
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: colors.inputBg }}>
                    <svg className="w-7 h-7" style={{ color: colors.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="font-semibold" style={{ color: colors.navy }}>Tutanak fotografı sec</p>
                  <p className="text-sm mt-1" style={{ color: colors.textMuted }}>veya cek</p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={dosyaSec}
              className="hidden"
            />

            {file && (
              <p className="text-sm text-center truncate" style={{ color: colors.textSecondary }}>{file.name}</p>
            )}

            {hata && (
              <div className="text-sm rounded-xl p-3" style={{ background: colors.redBg, color: colors.red, border: `1px solid ${colors.redBorder}` }}>
                {hata}
              </div>
            )}

            <button
              onClick={yukle}
              disabled={!file || durum === 'yukleniyor'}
              className="w-full text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
              style={{ background: isDark ? colors.accent : '#2B3674' }}
            >
              {durum === 'yukleniyor' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Isleniyor...
                </>
              ) : (
                'Tutanagi Yukle ve Isle'
              )}
            </button>

            <p className="text-xs text-center" style={{ color: colors.textMuted }}>
              Gorsel otomatik okunur ve sisteme kaydedilir
            </p>
          </div>
        )}

        <div className="text-center mt-6">
          <a href="/admin" className="text-sm font-medium transition-colors" style={{ color: colors.textMuted }}>
            Yonetici paneline git →
          </a>
        </div>
      </div>
    </main>
  )
}
