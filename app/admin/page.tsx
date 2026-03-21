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

const alkimBlue = '#2B3674'
const alkimAccent = '#4318FF'
const alkimLight = '#F4F7FE'

// Bolge renkleri
const bolgeRenkleri: Record<string, string> = {}
const renkPaleti = ['#4318FF', '#05CD99', '#FFB547', '#E31A1A', '#7551FF', '#01B574', '#EE5D50', '#868CFF', '#0B1437', '#A3AED0']
function getBolgeRenk(bolge: string): string {
  if (!bolgeRenkleri[bolge]) {
    bolgeRenkleri[bolge] = renkPaleti[Object.keys(bolgeRenkleri).length % renkPaleti.length]
  }
  return bolgeRenkleri[bolge]
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
  const [durumFilter, setDurumFilter] = useState('')
  const [idariBolgeler, setIdariBolgeler] = useState<string[]>([])
  const [magazaBolgeMap, setMagazaBolgeMap] = useState<Record<string, string>>({})
  const [sayfa, setSayfa] = useState(1)
  const sayfaBasi = 10

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

  const loadBolgeler = useCallback(() => {
    fetch('/api/magazalar')
      .then(r => r.json())
      .then(data => {
        const magazalar = data.magazalar || []
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

  function norm(s: string): string {
    return s.toLowerCase()
      .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
      .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/İ/g, 'i').replace(/Ğ/g, 'g').replace(/Ü/g, 'u')
      .replace(/Ş/g, 's').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
      .trim()
  }

  function getIdariBolge(t: Tutanak): string {
    if (t.magaza_no && magazaBolgeMap[t.magaza_no]) return magazaBolgeMap[t.magaza_no]
    if (t.bolge && idariBolgeler.length > 0) {
      const tBolge = norm(t.bolge)
      const exact = idariBolgeler.find(ib => norm(ib) === tBolge)
      if (exact) return exact
      const partial = idariBolgeler.find(ib => norm(ib).includes(tBolge))
      if (partial) return partial
      const reverse = idariBolgeler.find(ib => {
        const parts = norm(ib).split(' ')
        return parts.some(p => p.length > 3 && tBolge.includes(p))
      })
      if (reverse) return reverse
    }
    return t.bolge || ''
  }

  const filtreli = tutanaklar.filter((t) => {
    const aramaOk = !arama || [t.no, t.bolge, t.magaza, t.konu, t.sorumlu, t.aciklama]
      .join(' ').toLowerCase().includes(arama.toLowerCase())
    const bolgeOk = !bolgeFilter || getIdariBolge(t) === bolgeFilter
    const durumOk = !durumFilter ||
      (durumFilter === 'uyari' && t.dogrulama_durumu === 'uyari') ||
      (durumFilter === 'ok' && t.dogrulama_durumu !== 'uyari')
    return aramaOk && bolgeOk && durumOk
  })

  const toplamSayfa = Math.ceil(filtreli.length / sayfaBasi)
  const sayfaliData = filtreli.slice((sayfa - 1) * sayfaBasi, sayfa * sayfaBasi)

  const bolgeler = idariBolgeler.length > 0
    ? idariBolgeler
    : [...new Set(tutanaklar.map(t => t.bolge).filter(Boolean))].sort()

  function excelIndir() {
    const params = new URLSearchParams()
    if (bolgeFilter) params.set('bolge', bolgeFilter)
    window.open(`/api/export?${params.toString()}`, '_blank')
  }

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

  const toplamTutar = (items: TutanakItem[] | undefined) =>
    (items || []).reduce((sum, i) => sum + (i.toplam_tutar || 0), 0)

  // Istatistikler
  const uyariSayisi = tutanaklar.filter(t => t.dogrulama_durumu === 'uyari').length
  const toplamKalem = tutanaklar.reduce((s, t) => s + (t.tutanak_items?.length || 0), 0)
  const benzersizBolge = new Set(tutanaklar.map(t => getIdariBolge(t)).filter(Boolean)).size

  // Sidebar menu
  const menuItems = [
    { label: 'Kontrol Paneli', href: '/admin', active: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'POZ Kurallari', href: '/admin/rules', active: false, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: 'Birim Fiyatlar', href: '/admin/birim-fiyatlar', active: false, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Magazalar', href: '/admin/magazalar', active: false, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Uygulamacilar', href: '/admin/uygulamacilar', active: false, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  ]

  function filtreleriTemizle() {
    setArama('')
    setBolgeFilter('')
    setDurumFilter('')
    setSayfa(1)
  }

  return (
    <div className="flex min-h-screen" style={{ background: alkimLight }}>
      {/* Sol Sidebar */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-white border-r border-gray-200 px-5 py-6 fixed h-full z-10">
        {/* Logo */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: alkimAccent }}>A</div>
            <div>
              <h1 className="font-bold text-lg" style={{ color: alkimBlue }}>ALKIM Mimarlik</h1>
              <p className="text-[11px] text-gray-400 font-medium tracking-wider uppercase">Yonetim Paneli</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 space-y-1">
          {menuItems.map(item => (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? 'text-white shadow-lg'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
              style={item.active ? { background: alkimAccent } : {}}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Upload link */}
        <a
          href="/"
          className="flex items-center justify-center gap-2 mt-4 py-3 rounded-xl text-white font-semibold text-sm shadow-lg transition-transform hover:scale-[1.02]"
          style={{ background: `linear-gradient(135deg, ${alkimAccent}, #7551FF)` }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tutanak Yukle
        </a>
      </aside>

      {/* Ana icerik */}
      <main className="flex-1 lg:ml-[280px]">
        {/* Ust bar */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            {/* Mobil menu */}
            <div className="lg:hidden flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: alkimAccent }}>A</div>
              <span className="font-bold text-sm" style={{ color: alkimBlue }}>ALKIM</span>
            </div>
            <div className="hidden lg:block">
              <h2 className="text-2xl font-bold" style={{ color: alkimBlue }}>Tutanak Kayitlari</h2>
              <p className="text-sm text-gray-400">ALKIM Mimarlik Proje Yonetim Paneli</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={excelIndir}
                className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Excel Indir
              </button>
            </div>
          </div>
        </header>

        <div className="px-6 py-6">
          {/* Mobil nav */}
          <div className="lg:hidden flex gap-2 mb-4 overflow-x-auto pb-2">
            {menuItems.map(item => (
              <a key={item.label} href={item.href}
                className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium ${item.active ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                style={item.active ? { background: alkimAccent } : {}}>
                {item.label}
              </a>
            ))}
          </div>

          {/* Filtre alani */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Arama */}
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  placeholder="Magaza veya konu ara..."
                  value={arama}
                  onChange={(e) => { setArama(e.target.value); setSayfa(1) }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': alkimAccent + '44' } as React.CSSProperties}
                />
              </div>
              {/* Bolge */}
              <select
                value={bolgeFilter}
                onChange={(e) => { setBolgeFilter(e.target.value); setSayfa(1) }}
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white focus:outline-none min-w-[160px]"
              >
                <option value="">Tum Bolgeler</option>
                {bolgeler.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {/* Durum */}
              <select
                value={durumFilter}
                onChange={(e) => { setDurumFilter(e.target.value); setSayfa(1) }}
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white focus:outline-none min-w-[140px]"
              >
                <option value="">Tum Durumlar</option>
                <option value="ok">Dogrulanmis</option>
                <option value="uyari">Uyarilar</option>
              </select>
              {/* Temizle */}
              {(arama || bolgeFilter || durumFilter) && (
                <button onClick={filtreleriTemizle} className="text-sm text-gray-500 hover:text-gray-800 font-medium whitespace-nowrap px-3">
                  Filtreleri Temizle
                </button>
              )}
            </div>
          </div>

          {/* Tablo */}
          {yukleniyor ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-20 text-center">
              <div className="animate-pulse text-gray-400 text-lg">Yukleniyor...</div>
            </div>
          ) : filtreli.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-20 text-center">
              <p className="text-gray-400 text-lg">{arama || bolgeFilter || durumFilter ? 'Sonuc bulunamadi' : 'Henuz tutanak yok'}</p>
            </div>
          ) : (
            <>
              {/* Masaustu tablo */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: alkimBlue }}>
                      {['No', 'Tarih', 'Bolge', 'Magaza', 'Konu', 'Durum', 'Detay', 'Eylem'].map((h) => (
                        <th key={h} className="text-left px-4 py-3.5 text-white font-semibold text-xs uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sayfaliData.map((t) => {
                      const bolge = getIdariBolge(t) || t.bolge || '-'
                      const bolgeKisa = bolge.length > 12 ? bolge.split(' ').slice(-1)[0] : bolge
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSecili(t)}
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-sm font-bold" style={{ color: alkimBlue }}>#{t.no || '-'}</span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-600">{t.tarih || '-'}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className="text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                              style={{ background: getBolgeRenk(bolge) }}
                              title={bolge}
                            >
                              {bolgeKisa}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div>
                              <span className="text-gray-800 font-medium text-sm">{t.magaza_no || ''}</span>
                              <p className="text-gray-500 text-xs">{t.magaza || '-'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {t.konu ? (
                              <span className="text-gray-700 text-xs">{t.konu.length > 25 ? t.konu.slice(0, 25) + '...' : t.konu}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {t.dogrulama_durumu === 'uyari' ? (
                              <span className="text-orange-600 bg-orange-50 text-[11px] font-bold px-2.5 py-1 rounded-full">Incelenmeli</span>
                            ) : (
                              <span className="text-green-600 bg-green-50 text-[11px] font-bold px-2.5 py-1 rounded-full">Dogrulanmis</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {t.gorsel_url ? (
                              <div className="flex items-center gap-1">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden">
                                  <img src={t.gorsel_url} alt="" className="w-full h-full object-cover" />
                                </div>
                                <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: alkimAccent + '15', color: alkimAccent }}>
                                  {t.tutanak_items?.length || 0}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: alkimAccent + '15', color: alkimAccent }}>
                                {t.tutanak_items?.length || 0} kalem
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSecili(t) }}
                              className="text-gray-400 hover:text-gray-700 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    <b>{(sayfa - 1) * sayfaBasi + 1}-{Math.min(sayfa * sayfaBasi, filtreli.length)}</b> / {filtreli.length} kayit gosteriliyor
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSayfa(Math.max(1, sayfa - 1))}
                      disabled={sayfa === 1}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    >
                      &larr;
                    </button>
                    {Array.from({ length: Math.min(toplamSayfa, 5) }, (_, i) => {
                      let pageNum = i + 1
                      if (toplamSayfa > 5) {
                        if (sayfa <= 3) pageNum = i + 1
                        else if (sayfa >= toplamSayfa - 2) pageNum = toplamSayfa - 4 + i
                        else pageNum = sayfa - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setSayfa(pageNum)}
                          className={`w-9 h-9 text-sm rounded-lg font-medium transition-colors ${
                            sayfa === pageNum ? 'text-white shadow' : 'text-gray-600 hover:bg-gray-50 border border-gray-200'
                          }`}
                          style={sayfa === pageNum ? { background: alkimAccent } : {}}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setSayfa(Math.min(toplamSayfa, sayfa + 1))}
                      disabled={sayfa === toplamSayfa}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                    >
                      &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobil kartlar */}
              <div className="md:hidden space-y-3 mb-4">
                {sayfaliData.map((t) => {
                  const bolge = getIdariBolge(t) || t.bolge || '-'
                  return (
                    <div key={t.id} onClick={() => setSecili(t)} className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer border border-gray-100 active:scale-[0.98] transition-transform">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-sm font-bold" style={{ color: alkimBlue }}>#{t.no || '-'}</span>
                        <div className="flex gap-1.5 items-center">
                          {t.dogrulama_durumu === 'uyari' && <span className="text-orange-600 bg-orange-50 text-[10px] font-bold px-2 py-0.5 rounded-full">Uyari</span>}
                          <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: alkimAccent + '15', color: alkimAccent }}>
                            {t.tutanak_items?.length || 0} kalem
                          </span>
                        </div>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm">{t.magaza || '-'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: getBolgeRenk(bolge) }}>{bolge.split(' ').slice(-1)[0]}</span>
                        <span className="text-gray-400 text-xs">{t.tarih}</span>
                      </div>
                    </div>
                  )
                })}
                {/* Mobil pagination */}
                <div className="flex justify-center gap-2 py-3">
                  <button onClick={() => setSayfa(Math.max(1, sayfa - 1))} disabled={sayfa === 1} className="px-4 py-2 bg-white border rounded-lg text-sm disabled:opacity-30">&larr;</button>
                  <span className="px-4 py-2 text-sm text-gray-600">{sayfa}/{toplamSayfa}</span>
                  <button onClick={() => setSayfa(Math.min(toplamSayfa, sayfa + 1))} disabled={sayfa === toplamSayfa} className="px-4 py-2 bg-white border rounded-lg text-sm disabled:opacity-30">&rarr;</button>
                </div>
              </div>
            </>
          )}

          {/* Istatistik kartlari */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            {[
              { label: 'Toplam Tutanak', value: tutanaklar.length, color: alkimAccent, bg: alkimAccent + '12' },
              { label: 'Incelenmesi Gereken', value: uyariSayisi, color: '#FFB547', bg: '#FFB54712' },
              { label: 'Toplam Is Kalemi', value: toplamKalem, color: '#05CD99', bg: '#05CD9912' },
              { label: 'Bolge Sayisi', value: benzersizBolge, color: '#E31A1A', bg: '#E31A1A12' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{stat.label}</p>
                <p className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Detay modal */}
      {secili && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4"
          onClick={() => { setSecili(null); setEditingItem(null); setSilmeOnay(null); setSilmeYazi('') }}
        >
          <div
            className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-white rounded-t-3xl md:rounded-t-2xl border-b border-gray-100 px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="font-bold text-lg" style={{ color: alkimBlue }}>Tutanak #{secili.no || '-'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{secili.tarih} - {secili.magaza || getIdariBolge(secili)}</p>
              </div>
              <button onClick={() => { setSecili(null); setEditingItem(null); setSilmeOnay(null); setSilmeYazi('') }} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 text-lg transition-colors">&times;</button>
            </div>

            <div className="p-6">
              {/* Gorsel */}
              {secili.gorsel_url && (
                <a href={secili.gorsel_url} target="_blank">
                  <img src={secili.gorsel_url} alt="Tutanak gorseli" className="w-full rounded-2xl mb-5 object-contain max-h-60 border border-gray-100 hover:opacity-90 transition-opacity" />
                </a>
              )}

              {/* Dogrulama Uyarisi */}
              {secili.dogrulama_durumu === 'uyari' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-orange-800 text-sm">Dogrulama Uyarisi</p>
                    <p className="text-orange-600 text-xs mt-1">{secili.dogrulama_notlari}</p>
                  </div>
                </div>
              )}

              {/* Bilgiler */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  ['Tutanak No', secili.no],
                  ['Tarih', secili.tarih],
                  ['Mudahale Tarihi', secili.mudahale_tarihi],
                  ['Bolge', getIdariBolge(secili)],
                  ['Magaza', secili.magaza],
                  ['Magaza No', secili.magaza_no],
                  ['Adres', secili.adres],
                  ['Cagri No', secili.cagri_no],
                  ['Konu', secili.konu],
                  ['Firma Sorumlusu', secili.firma_sorumlusu],
                  ['Sorumlu', secili.sorumlu],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">{label}</p>
                    <p className="font-semibold text-sm text-gray-800 mt-0.5">{value || '-'}</p>
                  </div>
                ))}
              </div>

              {/* Is kalemleri */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold" style={{ color: alkimBlue }}>Is Kalemleri</h3>
                  <button
                    onClick={() => addItem(secili.id)}
                    disabled={saving}
                    className="text-white text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
                    style={{ background: '#05CD99' }}
                  >
                    + Yeni Kalem
                  </button>
                </div>

                {(!secili.tutanak_items || secili.tutanak_items.length === 0) ? (
                  <p className="text-gray-400 text-sm text-center py-6">Is kalemi yok</p>
                ) : (
                  <div className="space-y-2">
                    {secili.tutanak_items
                      .sort((a, b) => a.sira_no - b.sira_no)
                      .map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                          {editingItem === item.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[11px] text-gray-400 font-medium">POZ Kodu</label>
                                  <input type="text" value={editValues.poz_kodu || ''} onChange={(e) => setEditValues({ ...editValues, poz_kodu: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-800" />
                                </div>
                                <div>
                                  <label className="text-[11px] text-gray-400 font-medium">Miktar</label>
                                  <input type="number" value={editValues.miktar || 0} onChange={(e) => setEditValues({ ...editValues, miktar: parseFloat(e.target.value) })} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-800" />
                                </div>
                                <div>
                                  <label className="text-[11px] text-gray-400 font-medium">Birim</label>
                                  <input type="text" value={editValues.birim || ''} onChange={(e) => setEditValues({ ...editValues, birim: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-800" />
                                </div>
                              </div>
                              <div>
                                <label className="text-[11px] text-gray-400 font-medium">Aciklama</label>
                                <input type="text" value={editValues.aciklama || ''} onChange={(e) => setEditValues({ ...editValues, aciklama: e.target.value })} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-800" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => updateItem(item.id, editValues)} disabled={saving} className="text-white text-xs px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50" style={{ background: alkimAccent }}>
                                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                                <button onClick={() => setEditingItem(null)} className="bg-gray-200 text-gray-600 text-xs px-4 py-1.5 rounded-lg font-semibold hover:bg-gray-300">Iptal</button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-white px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold" style={{ background: alkimAccent }}>{item.poz_kodu}</span>
                                  <span className="text-[11px] text-gray-400">#{item.sira_no}</span>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => { setEditingItem(item.id); setEditValues({ poz_kodu: item.poz_kodu, miktar: item.miktar, birim: item.birim, aciklama: item.aciklama }) }} className="text-xs font-medium hover:underline" style={{ color: alkimAccent }}>Duzenle</button>
                                  <button onClick={() => deleteItem(item.id)} disabled={saving} className="text-red-400 text-xs hover:underline font-medium disabled:opacity-50">Sil</button>
                                </div>
                              </div>
                              <p className="text-sm text-gray-800 font-medium mb-1">{item.aciklama}</p>
                              <div className="flex gap-4 text-xs text-gray-500">
                                <span>Miktar: <b className="text-gray-700">{item.miktar} {item.birim}</b></span>
                                <span>Birim: <b className="text-gray-700">{item.birim_fiyat?.toLocaleString('tr-TR')} TL</b></span>
                                <span className="font-bold" style={{ color: alkimAccent }}>Toplam: {item.toplam_tutar?.toLocaleString('tr-TR')} TL</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                    <div className="rounded-xl p-4 flex justify-between items-center" style={{ background: alkimAccent + '10' }}>
                      <span className="font-bold text-gray-800">Genel Toplam</span>
                      <span className="font-bold text-xl" style={{ color: alkimAccent }}>{toplamTutar(secili.tutanak_items).toLocaleString('tr-TR')} TL</span>
                    </div>
                  </div>
                )}

                {/* Silme */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  {silmeOnay === secili.id ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="font-semibold text-red-800 text-sm mb-2">Bu tutanagi silmek istediginize emin misiniz?</p>
                      <p className="text-red-500 text-xs mb-3">Bu islem geri alinamaz. Tutanak ve tum is kalemleri silinecektir.</p>
                      <p className="text-red-700 text-xs mb-2">Onaylamak icin tutanak numarasini yazin: <b>{secili.no}</b></p>
                      <input
                        value={silmeYazi}
                        onChange={e => setSilmeYazi(e.target.value)}
                        placeholder={secili.no || 'Tutanak no'}
                        className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-300 text-gray-800"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => tutanakSil(secili.id)} disabled={silmeYazi !== secili.no || siliniyor} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-700">{siliniyor ? 'Siliniyor...' : 'Evet, Sil'}</button>
                        <button onClick={() => { setSilmeOnay(null); setSilmeYazi('') }} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200">Vazgec</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setSilmeOnay(secili.id)} className="text-red-300 text-xs hover:text-red-500 transition-colors">Tutanagi Sil</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
