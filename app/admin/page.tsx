'use client'

import { useState, useEffect } from 'react'

type Tutanak = {
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

export default function AdminPage() {
  const [tutanaklar, setTutanaklar] = useState<Tutanak[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [secili, setSecili] = useState<Tutanak | null>(null)
  const [arama, setArama] = useState('')

  useEffect(() => {
    fetch('/api/tutanaklar')
      .then((r) => r.json())
      .then((data) => {
        setTutanaklar(Array.isArray(data) ? data : [])
        setYukleniyor(false)
      })
  }, [])

  const filtreli = tutanaklar.filter((t) =>
    [t.no, t.bolge, t.magaza, t.konu, t.sorumlu, t.aciklama]
      .join(' ')
      .toLowerCase()
      .includes(arama.toLowerCase())
  )

  function excelIndir() {
    window.open('/api/export', '_blank')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between shadow">
        <div>
          <h1 className="text-lg font-bold">ALKIM — Yönetici Paneli</h1>
          <p className="text-sm opacity-80">{tutanaklar.length} tutanak kayıtlı</p>
        </div>
        <button
          onClick={excelIndir}
          className="bg-white text-red-600 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
        >
          Excel İndir
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Arama */}
        <input
          type="text"
          placeholder="Bölge, mağaza, konu, sorumlu ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-6 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
        />

        {yukleniyor ? (
          <div className="text-center py-20 text-gray-400">Yükleniyor...</div>
        ) : filtreli.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {arama ? 'Sonuç bulunamadı' : 'Henüz tutanak yok'}
          </div>
        ) : (
          <>
            {/* Tablo (masaüstü) */}
            <div className="hidden md:block bg-white rounded-2xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-gray-500 font-medium">
                  <tr>
                    {['No', 'Tarih', 'Bölge', 'Mağaza', 'Konu', 'Sorumlu', 'Görsel'].map((h) => (
                      <th key={h} className="text-left px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtreli.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSecili(t)}
                      className="border-b last:border-0 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{t.no || '—'}</td>
                      <td className="px-4 py-3">{t.tarih || '—'}</td>
                      <td className="px-4 py-3">{t.bolge || '—'}</td>
                      <td className="px-4 py-3">{t.magaza || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          {t.konu || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{t.sorumlu || '—'}</td>
                      <td className="px-4 py-3">
                        {t.gorsel_url ? (
                          <a
                            href={t.gorsel_url}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="text-red-600 underline text-xs"
                          >
                            Gör
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartlar (mobil) */}
            <div className="md:hidden space-y-3">
              {filtreli.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSecili(t)}
                  className="bg-white rounded-xl shadow p-4 cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-gray-400">#{t.no || '—'}</span>
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {t.konu || '—'}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-800">{t.magaza || '—'}</p>
                  <p className="text-sm text-gray-500">{t.bolge} · {t.tarih}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Detay modal */}
      {secili && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4"
          onClick={() => setSecili(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-800">Tutanak Detayı</h2>
                <button onClick={() => setSecili(null)} className="text-gray-400 text-xl">✕</button>
              </div>
              {secili.gorsel_url && (
                <img
                  src={secili.gorsel_url}
                  alt="Tutanak görseli"
                  className="w-full rounded-xl mb-4 object-contain max-h-64"
                />
              )}
              <div className="space-y-2 text-sm">
                {[
                  ['Tutanak No', secili.no],
                  ['Tarih', secili.tarih],
                  ['Müdahale Tarihi', secili.mudahale_tarihi],
                  ['Bölge', secili.bolge],
                  ['Mağaza', secili.magaza],
                  ['Adres', secili.adres],
                  ['Çağrı No', secili.cagri_no],
                  ['Konu', secili.konu],
                  ['Firma Sorumlusu', secili.firma_sorumlusu],
                  ['Sorumlu', secili.sorumlu],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-right max-w-[60%]">{value || '—'}</span>
                  </div>
                ))}
                <div>
                  <p className="text-gray-500 mb-1">Açıklama</p>
                  <p className="text-gray-700 leading-relaxed">{secili.aciklama || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
