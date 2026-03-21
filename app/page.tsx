'use client'

import { useState, useRef } from 'react'

export default function CalısanPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [durum, setDurum] = useState<'bosta' | 'yukleniyor' | 'basarili' | 'hata'>('bosta')
  const [sonuc, setSonuc] = useState<Record<string, string> | null>(null)
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
      setSonuc(json.tutanak)
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

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-md">
        <div className="bg-red-600 text-white rounded-2xl p-5 mb-6 text-center shadow">
          <h1 className="text-xl font-bold tracking-wide">ALKIM</h1>
          <p className="text-sm opacity-90 mt-1">Tutanak Yükleme</p>
        </div>

        {durum === 'basarili' && sonuc ? (
          <div className="bg-white rounded-2xl shadow p-5 space-y-3">
            <div className="flex items-center gap-2 text-green-600 font-semibold text-lg mb-2">
              <span>✓</span> Tutanak Kaydedildi
            </div>
            {[
              ['Tutanak No', sonuc.no],
              ['Tarih', sonuc.tarih],
              ['Bölge', sonuc.bolge],
              ['Mağaza', sonuc.magaza],
              ['Konu', sonuc.konu],
              ['Sorumlu', sonuc.sorumlu],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm border-b pb-2">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-right max-w-[55%]">{value || '—'}</span>
              </div>
            ))}
            <div className="text-sm text-gray-500 pt-1">
              <span className="font-medium text-gray-700">Açıklama:</span>
              <p className="mt-1 text-gray-700 leading-relaxed">{sonuc.aciklama || '—'}</p>
            </div>
            <button
              onClick={sifirla}
              className="w-full mt-4 bg-red-600 text-white py-3 rounded-xl font-semibold text-sm"
            >
              Yeni Tutanak Yükle
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-red-400 transition-colors"
            >
              {preview ? (
                <img src={preview} alt="Önizleme" className="mx-auto max-h-64 rounded-lg object-contain" />
              ) : (
                <>
                  <div className="text-5xl mb-3">📷</div>
                  <p className="text-gray-600 font-medium">Tutanak fotoğrafı seç</p>
                  <p className="text-gray-400 text-sm mt-1">veya çek</p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={dosyaSec}
              className="hidden"
            />

            {file && (
              <p className="text-sm text-gray-500 text-center truncate">{file.name}</p>
            )}

            {hata && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {hata}
              </div>
            )}

            <button
              onClick={yukle}
              disabled={!file || durum === 'yukleniyor'}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {durum === 'yukleniyor' ? (
                <>
                  <span className="animate-spin inline-block">⟳</span> İşleniyor...
                </>
              ) : (
                'Tutanağı Yükle ve İşle'
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Görsel otomatik okunur ve sisteme kaydedilir
            </p>
          </div>
        )}

        <div className="text-center mt-6">
          <a href="/admin" className="text-sm text-gray-400 underline">
            Yönetici paneline git →
          </a>
        </div>
      </div>
    </main>
  )
}
