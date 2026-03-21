'use client'

import { useState, useEffect, useCallback } from 'react'

type TutanakItem = {
  id: string
  tutanak_id: string
  sira_no: number
  aciklama: string
  miktar: number
  birim: string
  poz_kodu: string
  poz_aciklama: string
  birim_fiyat: number
  toplam_tutar: number
}

type Tutanak = {
  id: string
  no: string
  tarih: string
  mudahale_tarihi: string
  bolge: string
  magaza: string
  magaza_no: string
  adres: string
  cagri_no: string
  konu: string
  aciklama: string
  firma_sorumlusu: string
  sorumlu: string
  gorsel_url: string
  created_at: string
  dogrulama_durumu?: string
  dogrulama_notlari?: string
  tutanak_items?: TutanakItem[]
}

export default function AdminPage() {
  const [tutanaklar, setTutanaklar] = useState<Tutanak[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [secili, setSecili] = useState<Tutanak | null>(null)
  const [arama, setArama] = useState('')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<TutanakItem>>({})
  const [saving, setSaving] = useState(false)
  const [silmeOnay, setSilmeOnay] = useState<string | null>(null)
  const [silmeYazi, setSilmeYazi] = useState('')
  const [siliniyor, setSiliniyor] = useState(false)
  const [bolgeFilter, setBolgeFilter] = useState('')
  const [idariBolgeler, setIdariBolgeler] = useState<string[]>([])
  const [magazaBolgeMap, setMagazaBolgeMap] = useState<Record<string, string>>({})

  const loadData = useCallback(() => {
    fetch('/api/tutanaklar')
      .then((r) => r.json())
      .then((data) => {
        setTutanaklar(Array.isArray(data) ? data : [])
        setYukleniyor(false)
      })
  }, [])

  const tutanakSil = async (id: string) => {
    setSiliniyor(true)
    try {
      const res = await fetch('/api/tutanaklar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSecili(null)
      setSilmeOnay(null)
      setSilmeYazi('')
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Silme hatasi')
    }
    setSiliniyor(false)
  }

  // Magaza referans verisinden idari bolgeleri cek
  const loadBolgeler = useCallback(() => {
    fetch('/api/magazalar')
      .then(r => r.json())
      .then(data => {
        const magazalar = data.magazalar || []
        // Magaza kodu → idari bolge map
        const bMap: Record<string, string> = {}
        const bolgeSet = new Set<string>()
        for (const m of magazalar) {
          if (m.kod && m.idari_bolge) {
            bMap[m.kod] = m.idari_bolge
            bolgeSet.add(m.idari_bolge)
          }
        }
        setMagazaBolgeMap(bMap)
        setIdariBolgeler([...bolgeSet].sort())
      })
  }, [])

  useEffect(() => {
    loadData()
    loadBolgeler()
  }, [loadData, loadBolgeler])

  // Turkce normalize
  function norm(s: string): string {
    return s.toLowerCase()
      .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
      .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/İ/g, 'i').replace(/Ğ/g, 'g').replace(/Ü/g, 'u')
      .replace(/Ş/g, 's').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
      .trim()
  }

  // Tutanagin idari bolgesini bul
  function getIdariBolge(t: Tutanak): string {
    // 1. Magaza kodu varsa direkt esle
    if (t.magaza_no && magazaBolgeMap[t.magaza_no]) {
      return magazaBolgeMap[t.magaza_no]
    }

    // 2. Tutanaktaki bolge adini idari bolgeyle fuzzy esle
    // Ornek: "Çukurova" → "ADANA ÇUKUROVA", "SEYHAN" → "ADANA SEYHAN"
    if (t.bolge && idariBolgeler.length > 0) {
      const tBolge = norm(t.bolge)

      // Tam esleme
      const exact = idariBolgeler.find(ib => norm(ib) === tBolge)
      if (exact) return exact

      // Tutanaktaki bolge idari bolgenin icinde geciyor mu?
      // "cukurova" → "adana cukurova" icinde var
      const partial = idariBolgeler.find(ib => norm(ib).includes(tBolge))
      if (partial) return partial

      // Idari bolgenin parcasi tutanaktaki bolgenin icinde mi?
      // "11209 adana" → "adana" iceriyor
      const reverse = idariBolgeler.find(ib => {
        const parts = norm(ib).split(' ')
        return parts.some(p => p.length > 3 && tBolge.includes(p))
      })
      if (reverse) return reverse
    }

    return t.bolge || ''
  }

  // Bolge + arama filtresi birlikte calisiyor
  const filtreli = tutanaklar.filter((t) => {
    const aramaOk = !arama || [t.no, t.bolge, t.magaza, t.konu, t.sorumlu, t.aciklama]
      .join(' ')
      .toLowerCase()
      .includes(arama.toLowerCase())
    const bolgeOk = !bolgeFilter || getIdariBolge(t) === bolgeFilter
    return aramaOk && bolgeOk
  })

  // Dropdown'da idari bolgeler gosterilecek (referans verisinden)
  // Eger referans yoksa tutanaktaki bolgelerden al
  const bolgeler = idariBolgeler.length > 0
    ? idariBolgeler
    : [...new Set(tutanaklar.map(t => t.bolge).filter(Boolean))].sort()

  function excelIndir() {
    const params = new URLSearchParams()
    if (bolgeFilter) params.set('bolge', bolgeFilter)
    window.open(`/api/export?${params.toString()}`, '_blank')
  }

  // Is kalemi guncelle
  async function updateItem(itemId: string, updates: Partial<TutanakItem>) {
    setSaving(true)
    try {
      const res = await fetch('/api/tutanak-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, ...updates }),
      })
      if (!res.ok) throw new Error('Guncelleme hatasi')
      setEditingItem(null)
      loadData()
      if (secili) {
        const updatedRes = await fetch('/api/tutanaklar')
        const allData = await updatedRes.json()
        const updated = (allData as Tutanak[]).find(t => t.id === secili.id)
        if (updated) setSecili(updated)
      }
    } catch {
      alert('Guncelleme hatasi!')
    }
    setSaving(false)
  }

  // Is kalemi sil
  async function deleteItem(itemId: string) {
    if (!confirm('Bu is kalemini silmek istediginize emin misiniz?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tutanak-items?id=${itemId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Silme hatasi')
      loadData()
      if (secili) {
        const items = secili.tutanak_items?.filter(i => i.id !== itemId) || []
        setSecili({ ...secili, tutanak_items: items })
      }
    } catch {
      alert('Silme hatasi!')
    }
    setSaving(false)
  }

  // Yeni is kalemi ekle
  async function addItem(tutanakId: string) {
    setSaving(true)
    try {
      const maxSira = Math.max(0, ...(secili?.tutanak_items?.map(i => i.sira_no) || [0]))
      const res = await fetch('/api/tutanak-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutanak_id: tutanakId,
          sira_no: maxSira + 1,
          aciklama: 'Yeni is kalemi',
          miktar: 1,
          poz_kodu: 'S-09',
        }),
      })
      if (!res.ok) throw new Error('Ekleme hatasi')
      loadData()
      const updatedRes = await fetch('/api/tutanaklar')
      const allData = await updatedRes.json()
      const updated = (allData as Tutanak[]).find((t: Tutanak) => t.id === tutanakId)
      if (updated) setSecili(updated)
    } catch {
      alert('Ekleme hatasi!')
    }
    setSaving(false)
  }

  const toplamTutar = (items: TutanakItem[]) =>
    items.reduce((sum, i) => sum + (i.toplam_tutar || 0), 0)

  // Alkim renkleri
  const alkimBlue = '#2855A0'
  const alkimBlueDark = '#1E3F7A'
  const alkimBlueLight = '#3A6BC5'

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header - Alkim mavi tema */}
      <div className="text-white px-6 py-4 flex items-center justify-between shadow-lg" style={{ background: `linear-gradient(135deg, ${alkimBlueDark}, ${alkimBlue})` }}>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-wide">ALKIM Mimarlik</h1>
            <p className="text-sm text-blue-200">{tutanaklar.length} tutanak kayitli</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={bolgeFilter}
            onChange={(e) => setBolgeFilter(e.target.value)}
            className="bg-white/20 text-white border border-white/30 rounded-lg px-3 py-2 text-sm backdrop-blur"
          >
            <option value="" className="text-gray-800">Tum Bolgeler</option>
            {bolgeler.map(b => (
              <option key={b} value={b} className="text-gray-800">{b}</option>
            ))}
          </select>
          <button
            onClick={excelIndir}
            className="font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
            style={{ background: 'white', color: alkimBlue }}
          >
            Excel Indir
          </button>
        </div>
      </div>

      {/* Referans Veri Yonetimi */}
      <div className="px-6 py-2 flex items-center gap-3 text-sm" style={{ background: alkimBlueDark }}>
        <span className="text-blue-300 mr-2">Referans Veri:</span>
        <a href="/admin/rules" className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded transition-colors">POZ Eslestirme Kurallari</a>
        <a href="/admin/birim-fiyatlar" className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded transition-colors">Birim Fiyatlar</a>
        <a href="/admin/magazalar" className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded transition-colors">Magazalar</a>
        <a href="/admin/uygulamacilar" className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded transition-colors">Uygulamacilar</a>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Arama */}
        <input
          type="text"
          placeholder="Tutanak no, bolge, magaza, konu ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-6 text-sm bg-white focus:outline-none focus:ring-2 text-gray-800 placeholder-gray-400"
          style={{ focusRingColor: alkimBlue } as React.CSSProperties}
        />

        {/* Filtre bilgisi */}
        {bolgeFilter && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-600">Filtre:</span>
            <span className="text-sm font-semibold text-white px-3 py-1 rounded-full" style={{ background: alkimBlue }}>{bolgeFilter}</span>
            <button onClick={() => setBolgeFilter('')} className="text-xs text-gray-500 hover:text-gray-700 underline">Temizle</button>
            <span className="text-sm text-gray-500 ml-2">({filtreli.length} sonuc)</span>
          </div>
        )}

        {yukleniyor ? (
          <div className="text-center py-20 text-gray-500 text-lg">Yukleniyor...</div>
        ) : filtreli.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-lg">
            {arama || bolgeFilter ? 'Sonuc bulunamadi' : 'Henuz tutanak yok'}
          </div>
        ) : (
          <>
            {/* Tablo (masaustu) */}
            <div className="hidden md:block bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
              <table className="w-full text-sm">
                <thead style={{ background: alkimBlue }}>
                  <tr>
                    {['No', 'Tarih', 'Bolge', 'Magaza', 'Konu', 'Is Kalemleri', 'Gorsel'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-white font-semibold text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtreli.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSecili(t)}
                      className="border-b last:border-0 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">
                        <div className="flex items-center gap-1">
                          {t.no || '-'}
                          {t.dogrulama_durumu === 'uyari' && (
                            <span title={t.dogrulama_notlari || 'Dogrulama uyarisi'} className="text-amber-500 cursor-help text-base">&#9888;</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{t.tarih || '-'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{getIdariBolge(t) || t.bolge || '-'}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{t.magaza || '-'}</td>
                      <td className="px-4 py-3">
                        {t.konu ? (
                          <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-md text-xs font-semibold">{t.konu}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white px-3 py-1 rounded-md text-xs font-bold" style={{ background: alkimBlueLight }}>
                          {t.tutanak_items?.length || 0} kalem
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.gorsel_url ? (
                          <a
                            href={t.gorsel_url}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-xs underline"
                            style={{ color: alkimBlue }}
                          >
                            Gor
                          </a>
                        ) : <span className="text-gray-400">-</span>}
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
                  className="bg-white rounded-xl shadow-md p-4 cursor-pointer border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm font-bold text-gray-800">#{t.no || '-'}</span>
                    <div className="flex gap-1">
                      {t.konu && (
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-xs font-semibold">{t.konu}</span>
                      )}
                      <span className="text-white px-2 py-0.5 rounded-md text-xs font-bold" style={{ background: alkimBlueLight }}>
                        {t.tutanak_items?.length || 0} kalem
                      </span>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-800">{t.magaza || '-'}</p>
                  <p className="text-sm text-gray-600">{getIdariBolge(t) || t.bolge} · {t.tarih}</p>
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
          onClick={() => { setSecili(null); setEditingItem(null) }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-800 text-lg">Tutanak Detayi</h2>
                <button onClick={() => { setSecili(null); setEditingItem(null) }} className="text-gray-400 text-2xl hover:text-gray-600 leading-none">&times;</button>
              </div>

              {secili.gorsel_url && (
                <img
                  src={secili.gorsel_url}
                  alt="Tutanak gorseli"
                  className="w-full rounded-xl mb-4 object-contain max-h-64 border"
                />
              )}

              {/* Dogrulama Uyarisi */}
              {secili.dogrulama_durumu === 'uyari' && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <span className="text-amber-500 text-lg">&#9888;</span>
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">Dogrulama Uyarisi</p>
                    <p className="text-amber-700 text-xs mt-1">{secili.dogrulama_notlari}</p>
                    <p className="text-amber-600 text-xs mt-1">Magaza kodunu kontrol edip duzeltmeniz gerekebilir.</p>
                  </div>
                </div>
              )}

              {/* Header bilgileri */}
              <div className="grid grid-cols-2 gap-2 text-sm mb-6">
                {[
                  ['Tutanak No', secili.no],
                  ['Tarih', secili.tarih],
                  ['Mudahale Tarihi', secili.mudahale_tarihi],
                  ['Bolge', secili.bolge],
                  ['Magaza', secili.magaza],
                  ['Magaza No', secili.magaza_no],
                  ['Adres', secili.adres],
                  ['Cagri No', secili.cagri_no],
                  ['Konu', secili.konu],
                  ['Firma Sorumlusu', secili.firma_sorumlusu],
                  ['Sorumlu', secili.sorumlu],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-gray-200 pb-1">
                    <span className="text-gray-500 text-xs">{label}</span>
                    <span className="font-semibold text-right text-sm text-gray-800">{value || '-'}</span>
                  </div>
                ))}
              </div>

              {/* Is kalemleri */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-gray-800">Is Kalemleri</h3>
                  <button
                    onClick={() => addItem(secili.id)}
                    disabled={saving}
                    className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                  >
                    + Yeni Kalem
                  </button>
                </div>

                {(!secili.tutanak_items || secili.tutanak_items.length === 0) ? (
                  <p className="text-gray-500 text-sm">Is kalemi yok</p>
                ) : (
                  <div className="space-y-2">
                    {secili.tutanak_items
                      .sort((a, b) => a.sira_no - b.sira_no)
                      .map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                          {editingItem === item.id ? (
                            // Edit modu
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-xs text-gray-500 font-medium">POZ Kodu</label>
                                  <input
                                    type="text"
                                    value={editValues.poz_kodu || ''}
                                    onChange={(e) => setEditValues({ ...editValues, poz_kodu: e.target.value })}
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-800"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 font-medium">Miktar</label>
                                  <input
                                    type="number"
                                    value={editValues.miktar || 0}
                                    onChange={(e) => setEditValues({ ...editValues, miktar: parseFloat(e.target.value) })}
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-800"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 font-medium">Birim</label>
                                  <input
                                    type="text"
                                    value={editValues.birim || ''}
                                    onChange={(e) => setEditValues({ ...editValues, birim: e.target.value })}
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-800"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 font-medium">Aciklama</label>
                                <input
                                  type="text"
                                  value={editValues.aciklama || ''}
                                  onChange={(e) => setEditValues({ ...editValues, aciklama: e.target.value })}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-800"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => updateItem(item.id, editValues)}
                                  disabled={saving}
                                  className="text-white text-xs px-4 py-1.5 rounded font-semibold disabled:opacity-50"
                                  style={{ background: alkimBlue }}
                                >
                                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="bg-gray-200 text-gray-700 text-xs px-4 py-1.5 rounded font-semibold hover:bg-gray-300"
                                >
                                  Iptal
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Goruntuleme modu
                            <div>
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-white px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: alkimBlue }}>
                                    {item.poz_kodu}
                                  </span>
                                  <span className="text-xs text-gray-400 font-medium">#{item.sira_no}</span>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingItem(item.id)
                                      setEditValues({
                                        poz_kodu: item.poz_kodu,
                                        miktar: item.miktar,
                                        birim: item.birim,
                                        aciklama: item.aciklama,
                                      })
                                    }}
                                    className="text-xs hover:underline font-medium"
                                    style={{ color: alkimBlue }}
                                  >
                                    Duzenle
                                  </button>
                                  <button
                                    onClick={() => deleteItem(item.id)}
                                    disabled={saving}
                                    className="text-red-600 text-xs hover:underline font-medium disabled:opacity-50"
                                  >
                                    Sil
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-gray-800 mb-1 font-medium">{item.aciklama}</p>
                              {item.poz_aciklama && item.poz_aciklama !== item.aciklama && (
                                <p className="text-xs text-gray-500 mb-1">POZ: {item.poz_aciklama}</p>
                              )}
                              <div className="flex gap-4 text-xs text-gray-600">
                                <span>Miktar: <b className="text-gray-800">{item.miktar} {item.birim}</b></span>
                                <span>Birim Fiyat: <b className="text-gray-800">{item.birim_fiyat?.toLocaleString('tr-TR')} TL</b></span>
                                <span className="font-bold" style={{ color: alkimBlue }}>
                                  Toplam: {item.toplam_tutar?.toLocaleString('tr-TR')} TL
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                    {/* Alt toplam */}
                    <div className="rounded-xl p-3 border-2 flex justify-between items-center" style={{ background: '#EBF0F8', borderColor: alkimBlue + '44' }}>
                      <span className="font-bold text-gray-800">Genel Toplam</span>
                      <span className="font-bold text-lg" style={{ color: alkimBlue }}>
                        {toplamTutar(secili.tutanak_items).toLocaleString('tr-TR')} TL
                      </span>
                    </div>
                  </div>
                )}

                {/* Tutanak Silme */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  {silmeOnay === secili.id ? (
                    <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                      <p className="font-semibold text-red-800 text-sm mb-2">Bu tutanagi silmek istediginize emin misiniz?</p>
                      <p className="text-red-600 text-xs mb-3">Bu islem geri alinamaz. Tutanak ve tum is kalemleri silinecektir.</p>
                      <p className="text-red-700 text-xs mb-2">Onaylamak icin tutanak numarasini yazin: <b>{secili.no}</b></p>
                      <input
                        value={silmeYazi}
                        onChange={e => setSilmeYazi(e.target.value)}
                        placeholder={secili.no || 'Tutanak no'}
                        className="w-full border border-red-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => tutanakSil(secili.id)}
                          disabled={silmeYazi !== secili.no || siliniyor}
                          className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700"
                        >
                          {siliniyor ? 'Siliniyor...' : 'Evet, Sil'}
                        </button>
                        <button
                          onClick={() => { setSilmeOnay(null); setSilmeYazi('') }}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-300"
                        >
                          Vazgec
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSilmeOnay(secili.id)}
                      className="text-red-400 text-xs hover:text-red-600 hover:underline"
                    >
                      Tutanagi Sil
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
