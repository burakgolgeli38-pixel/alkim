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

// Renk paleti - navy + beyaz, temiz kurumsal
const navy = '#2B3674'
const navyLight = '#3B4A8C'
const accent = '#4318FF'
const pageBg = '#F4F7FE'
const cardBg = '#FFFFFF'
const borderColor = '#E2E8F0'
const textPrimary = '#2B3674'
const textSecondary = '#8F9BBA'
const textMuted = '#A3AED0'

// Bolge renkleri - soft, muted tonlar
const bolgeBadgeStyles: Record<string, { bg: string; color: string; border: string }> = {}
const softPalette = [
  { bg: '#EEF0F8', color: '#3B4A8C', border: '#D0D5E8' },
  { bg: '#E8F5F0', color: '#1B7A5A', border: '#C6E6D8' },
  { bg: '#FFF3E0', color: '#B07020', border: '#F0D8B0' },
  { bg: '#F0EBF8', color: '#5B3E9E', border: '#D8CDE8' },
  { bg: '#E8F0F8', color: '#2B5E8C', border: '#C6D8E8' },
  { bg: '#F8ECE8', color: '#8C3B2B', border: '#E8CEC6' },
]
function getBolgeBadge(bolge: string) {
  if (!bolgeBadgeStyles[bolge]) {
    const idx = Object.keys(bolgeBadgeStyles).length % softPalette.length
    bolgeBadgeStyles[bolge] = softPalette[idx]
  }
  return bolgeBadgeStyles[bolge]
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
    { label: 'Dashboard', href: '/admin', active: true, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
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
    <div className="flex min-h-screen" style={{ background: pageBg }}>
      {/* Sol Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white fixed h-full z-10 px-5 py-6" style={{ borderRight: `1px solid ${borderColor}` }}>
        {/* Logo */}
        <div className="mb-10 px-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base" style={{ background: navy }}>A</div>
            <div>
              <h1 className="font-bold text-[15px] leading-tight" style={{ color: navy }}>ALKIM Mimarlik</h1>
              <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: textMuted }}>Yonetim Paneli</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 space-y-1">
          {menuItems.map(item => (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                item.active ? 'text-white' : 'hover:bg-gray-50'
              }`}
              style={item.active ? { background: navy, color: '#fff' } : { color: textSecondary }}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} /></svg>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Tutanak Yukle */}
        <a
          href="/"
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-transform hover:scale-[1.02]"
          style={{ background: accent }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          Tutanak Yukle
        </a>

        {/* Alt linkler */}
        <div className="mt-5 space-y-1 pt-4" style={{ borderTop: `1px solid ${borderColor}` }}>
          <a href="/" className="flex items-center gap-2 px-4 py-2 text-[13px] rounded-lg hover:bg-gray-50" style={{ color: textSecondary }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Destek
          </a>
        </div>
      </aside>

      {/* Ana icerik */}
      <main className="flex-1 lg:ml-[260px]">
        {/* Ust bar */}
        <header className="bg-white sticky top-0 z-20 px-6 py-3" style={{ borderBottom: `1px solid ${borderColor}` }}>
          <div className="flex items-center justify-between">
            {/* Mobil logo */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: navy }}>A</div>
              <span className="font-bold text-sm" style={{ color: navy }}>ALKIM</span>
            </div>
            {/* Desktop: sayfa basligi ust barda degil, asagida */}
            <div className="hidden lg:flex items-center gap-6">
              <span className="text-sm font-bold" style={{ color: navy }}>ALKIM Admin</span>
              <nav className="flex items-center gap-1">
                {menuItems.map(item => (
                  <a key={item.label} href={item.href}
                    className="px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors"
                    style={item.active ? { color: navy, borderBottom: `2px solid ${navy}` } : { color: textMuted }}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              {/* Global search - desktop */}
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: pageBg, color: textMuted }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <span className="text-[13px]">Ara...</span>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: navy, color: '#fff' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
            </div>
          </div>
        </header>

        <div className="px-6 py-6 max-w-[1200px]">
          {/* Sayfa basligi */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold" style={{ color: navy }}>Tutanak Kayitlari</h2>
              <p className="text-sm mt-0.5" style={{ color: textMuted }}>ALKIM Mimarlik Proje Yonetim Paneli</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={excelIndir}
                className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                style={{ color: navy, border: `1px solid ${borderColor}` }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Excel Export
              </button>
            </div>
          </div>

          {/* Mobil nav */}
          <div className="lg:hidden flex gap-2 mb-4 overflow-x-auto pb-2">
            {menuItems.map(item => (
              <a key={item.label} href={item.href}
                className="whitespace-nowrap px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                style={item.active ? { background: navy, color: '#fff' } : { background: '#fff', color: textSecondary, border: `1px solid ${borderColor}` }}>
                {item.label}
              </a>
            ))}
          </div>

          {/* Filtre alani */}
          <div className="bg-white rounded-2xl p-5 mb-6" style={{ border: `1px solid ${borderColor}` }}>
            <div className="flex flex-col md:flex-row gap-4 items-center">
              {/* Basliklar */}
              <div className="flex-1 w-full">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>Ara</p>
                <div className="relative">
                  <svg className="absolute left-3 top-2.5 w-4 h-4" style={{ color: textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    placeholder="Magaza veya konu ara..."
                    value={arama}
                    onChange={(e) => { setArama(e.target.value); setSayfa(1) }}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    style={{ background: pageBg, color: textPrimary, border: `1px solid ${borderColor}` }}
                  />
                </div>
              </div>
              {/* Bolge */}
              <div className="min-w-[160px]">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>Bolge</p>
                <select
                  value={bolgeFilter}
                  onChange={(e) => { setBolgeFilter(e.target.value); setSayfa(1) }}
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ background: pageBg, color: textPrimary, border: `1px solid ${borderColor}` }}
                >
                  <option value="">Tum Bolgeler</option>
                  {bolgeler.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {/* Durum */}
              <div className="min-w-[140px]">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>Durum</p>
                <select
                  value={durumFilter}
                  onChange={(e) => { setDurumFilter(e.target.value); setSayfa(1) }}
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ background: pageBg, color: textPrimary, border: `1px solid ${borderColor}` }}
                >
                  <option value="">Tum Durumlar</option>
                  <option value="ok">Dogrulanmis</option>
                  <option value="uyari">Incelenmeli</option>
                </select>
              </div>
              {/* Temizle */}
              <div className="min-w-[100px]">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-0">.</p>
                {(arama || bolgeFilter || durumFilter) ? (
                  <button onClick={filtreleriTemizle} className="w-full py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{ background: pageBg, color: textSecondary, border: `1px solid ${borderColor}` }}>
                    Temizle
                  </button>
                ) : <div className="h-[36px]" />}
              </div>
            </div>
          </div>

          {/* Tablo */}
          {yukleniyor ? (
            <div className="bg-white rounded-2xl p-20 text-center" style={{ border: `1px solid ${borderColor}` }}>
              <p style={{ color: textMuted }}>Yukleniyor...</p>
            </div>
          ) : filtreli.length === 0 ? (
            <div className="bg-white rounded-2xl p-20 text-center" style={{ border: `1px solid ${borderColor}` }}>
              <p style={{ color: textMuted }}>{arama || bolgeFilter || durumFilter ? 'Sonuc bulunamadi' : 'Henuz tutanak yok'}</p>
            </div>
          ) : (
            <>
              {/* Masaustu tablo */}
              <div className="hidden md:block bg-white rounded-2xl overflow-hidden mb-6" style={{ border: `1px solid ${borderColor}` }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: navy }}>
                      {['No', 'Tarih', 'Bolge', 'Magaza', 'Konu', 'Durum', 'Detay', ''].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-white text-[11px] font-bold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sayfaliData.map((t, idx) => {
                      const bolge = getIdariBolge(t) || t.bolge || '-'
                      const bolgeKisa = bolge.length > 14 ? bolge.split(' ').slice(-1)[0] : bolge
                      const badge = getBolgeBadge(bolge)
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSecili(t)}
                          className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                          style={{ borderBottom: idx < sayfaliData.length - 1 ? `1px solid ${borderColor}` : 'none' }}
                        >
                          <td className="px-5 py-4">
                            <span className="font-mono font-bold text-sm" style={{ color: navy }}>#{t.no || '-'}</span>
                          </td>
                          <td className="px-5 py-4" style={{ color: textSecondary }}>{t.tarih || '-'}</td>
                          <td className="px-5 py-4">
                            <span
                              className="text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                              style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                              title={bolge}
                            >
                              {bolgeKisa}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div>
                              <span className="font-semibold text-sm" style={{ color: navy }}>{t.magaza_no || ''}</span>
                              {t.magaza && <p className="text-xs mt-0.5" style={{ color: textMuted }}>{t.magaza}</p>}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs" style={{ color: textSecondary }}>
                              {t.konu ? (t.konu.length > 28 ? t.konu.slice(0, 28) + '...' : t.konu) : '-'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {t.dogrulama_durumu === 'uyari' ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />
                                <span className="text-xs font-semibold" style={{ color: '#B07020' }}>Incelenmeli</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
                                <span className="text-xs font-semibold" style={{ color: '#1B7A5A' }}>Dogrulanmis</span>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {t.gorsel_url && (
                                <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${borderColor}` }}>
                                  <img src={t.gorsel_url} alt="" className="w-full h-full object-cover" />
                                </div>
                              )}
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: pageBg, color: textSecondary }}>
                                +{t.tutanak_items?.length || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSecili(t) }}
                              style={{ color: textMuted }}
                              className="hover:opacity-70"
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
                <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${borderColor}` }}>
                  <p className="text-sm" style={{ color: textMuted }}>
                    Showing <b style={{ color: navy }}>{(sayfa - 1) * sayfaBasi + 1}-{Math.min(sayfa * sayfaBasi, filtreli.length)}</b> of {filtreli.length} records
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSayfa(Math.max(1, sayfa - 1))}
                      disabled={sayfa === 1}
                      className="w-9 h-9 text-sm rounded-lg transition-colors disabled:opacity-30 flex items-center justify-center"
                      style={{ border: `1px solid ${borderColor}`, color: textSecondary }}
                    >
                      &lsaquo;
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
                          className="w-9 h-9 text-sm rounded-lg font-semibold transition-colors flex items-center justify-center"
                          style={sayfa === pageNum
                            ? { background: navy, color: '#fff' }
                            : { border: `1px solid ${borderColor}`, color: textSecondary }
                          }
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setSayfa(Math.min(toplamSayfa, sayfa + 1))}
                      disabled={sayfa === toplamSayfa}
                      className="w-9 h-9 text-sm rounded-lg transition-colors disabled:opacity-30 flex items-center justify-center"
                      style={{ border: `1px solid ${borderColor}`, color: textSecondary }}
                    >
                      &rsaquo;
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobil kartlar */}
              <div className="md:hidden space-y-3 mb-6">
                {sayfaliData.map((t) => {
                  const bolge = getIdariBolge(t) || t.bolge || '-'
                  const badge = getBolgeBadge(bolge)
                  return (
                    <div key={t.id} onClick={() => setSecili(t)}
                      className="bg-white rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
                      style={{ border: `1px solid ${borderColor}` }}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-sm font-bold" style={{ color: navy }}>#{t.no || '-'}</span>
                        <div className="flex gap-1.5 items-center">
                          {t.dogrulama_durumu === 'uyari' && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
                              <span className="text-[10px] font-semibold" style={{ color: '#B07020' }}>Incelenmeli</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="font-semibold text-sm" style={{ color: navy }}>{t.magaza || t.magaza_no || '-'}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>{bolge.split(' ').slice(-1)[0]}</span>
                        <span className="text-xs" style={{ color: textMuted }}>{t.tarih}</span>
                        <span className="text-[10px] font-medium ml-auto" style={{ color: textMuted }}>{t.tutanak_items?.length || 0} kalem</span>
                      </div>
                    </div>
                  )
                })}
                {/* Mobil pagination */}
                <div className="flex justify-center gap-2 py-3">
                  <button onClick={() => setSayfa(Math.max(1, sayfa - 1))} disabled={sayfa === 1}
                    className="px-4 py-2 bg-white rounded-lg text-sm disabled:opacity-30" style={{ border: `1px solid ${borderColor}`, color: textSecondary }}>&lsaquo;</button>
                  <span className="px-4 py-2 text-sm font-medium" style={{ color: textSecondary }}>{sayfa}/{toplamSayfa}</span>
                  <button onClick={() => setSayfa(Math.min(toplamSayfa, sayfa + 1))} disabled={sayfa === toplamSayfa}
                    className="px-4 py-2 bg-white rounded-lg text-sm disabled:opacity-30" style={{ border: `1px solid ${borderColor}`, color: textSecondary }}>&rsaquo;</button>
                </div>
              </div>
            </>
          )}

          {/* Istatistik kartlari */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Aktif Tutanak', value: tutanaklar.length, featured: true, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
              { label: 'Incelenmesi Gereken', value: String(uyariSayisi).padStart(2, '0'), featured: false, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              { label: 'Toplam Is Kalemi', value: toplamKalem, featured: false, icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
              { label: 'Bolge Sayisi', value: benzersizBolge, featured: false, icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl p-5 flex items-center justify-between"
                style={stat.featured
                  ? { background: navy, color: '#fff' }
                  : { background: '#fff', border: `1px solid ${borderColor}` }
                }>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: stat.featured ? 'rgba(255,255,255,0.6)' : textMuted }}>{stat.label}</p>
                  <p className="text-3xl font-bold" style={{ color: stat.featured ? '#fff' : navy }}>{stat.value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: stat.featured ? 'rgba(255,255,255,0.15)' : pageBg }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    style={{ color: stat.featured ? 'rgba(255,255,255,0.7)' : textMuted }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={stat.icon} />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Detay modal */}
      {secili && (
        <div
          className="fixed inset-0 flex items-end md:items-center justify-center z-50 p-0 md:p-4"
          style={{ background: 'rgba(43,54,116,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setSecili(null); setEditingItem(null); setSilmeOnay(null); setSilmeYazi('') }}
        >
          <div
            className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
            style={{ border: `1px solid ${borderColor}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-white rounded-t-3xl md:rounded-t-2xl px-6 py-4 flex justify-between items-center z-10" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <div>
                <h2 className="font-bold text-lg" style={{ color: navy }}>Tutanak #{secili.no || '-'}</h2>
                <p className="text-xs mt-0.5" style={{ color: textMuted }}>{secili.tarih} - {secili.magaza || getIdariBolge(secili)}</p>
              </div>
              <button
                onClick={() => { setSecili(null); setEditingItem(null); setSilmeOnay(null); setSilmeYazi('') }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg hover:bg-gray-100 transition-colors"
                style={{ background: pageBg, color: textMuted }}
              >&times;</button>
            </div>

            <div className="p-6">
              {/* Gorsel */}
              {secili.gorsel_url && (
                <a href={secili.gorsel_url} target="_blank">
                  <img src={secili.gorsel_url} alt="Tutanak gorseli" className="w-full rounded-2xl mb-5 object-contain max-h-60 hover:opacity-90 transition-opacity" style={{ border: `1px solid ${borderColor}` }} />
                </a>
              )}

              {/* Dogrulama Uyarisi */}
              {secili.dogrulama_durumu === 'uyari' && (
                <div className="rounded-xl p-4 mb-5 flex items-start gap-3" style={{ background: '#FFF8EE', border: '1px solid #F0D8B0' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FEF0D0' }}>
                    <svg className="w-4 h-4" style={{ color: '#B07020' }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#8B5E20' }}>Dogrulama Uyarisi</p>
                    <p className="text-xs mt-1" style={{ color: '#A07030' }}>{secili.dogrulama_notlari}</p>
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
                  <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: pageBg }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>{label}</p>
                    <p className="font-semibold text-sm mt-0.5" style={{ color: navy }}>{value || '-'}</p>
                  </div>
                ))}
              </div>

              {/* Is kalemleri */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold" style={{ color: navy }}>Is Kalemleri</h3>
                  <button
                    onClick={() => addItem(secili.id)}
                    disabled={saving}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
                    style={{ background: '#E8F5F0', color: '#1B7A5A', border: '1px solid #C6E6D8' }}
                  >
                    + Yeni Kalem
                  </button>
                </div>

                {(!secili.tutanak_items || secili.tutanak_items.length === 0) ? (
                  <p className="text-center py-6" style={{ color: textMuted }}>Is kalemi yok</p>
                ) : (
                  <div className="space-y-2">
                    {secili.tutanak_items
                      .sort((a, b) => a.sira_no - b.sira_no)
                      .map((item) => (
                        <div key={item.id} className="rounded-xl p-3.5" style={{ background: pageBg, border: `1px solid ${borderColor}` }}>
                          {editingItem === item.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>POZ Kodu</label>
                                  <input type="text" value={editValues.poz_kodu || ''} onChange={(e) => setEditValues({ ...editValues, poz_kodu: e.target.value })}
                                    className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none" style={{ color: navy, border: `1px solid ${borderColor}` }} />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>Miktar</label>
                                  <input type="number" value={editValues.miktar || 0} onChange={(e) => setEditValues({ ...editValues, miktar: parseFloat(e.target.value) })}
                                    className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none" style={{ color: navy, border: `1px solid ${borderColor}` }} />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>Birim</label>
                                  <input type="text" value={editValues.birim || ''} onChange={(e) => setEditValues({ ...editValues, birim: e.target.value })}
                                    className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none" style={{ color: navy, border: `1px solid ${borderColor}` }} />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>Aciklama</label>
                                <input type="text" value={editValues.aciklama || ''} onChange={(e) => setEditValues({ ...editValues, aciklama: e.target.value })}
                                  className="w-full rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none" style={{ color: navy, border: `1px solid ${borderColor}` }} />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => updateItem(item.id, editValues)} disabled={saving}
                                  className="text-white text-xs px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50" style={{ background: navy }}>
                                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                                <button onClick={() => setEditingItem(null)}
                                  className="text-xs px-4 py-1.5 rounded-lg font-semibold bg-white" style={{ color: textSecondary, border: `1px solid ${borderColor}` }}>
                                  Iptal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-white px-2 py-0.5 rounded-md text-[11px] font-mono font-bold" style={{ background: navyLight }}>{item.poz_kodu}</span>
                                  <span className="text-[11px]" style={{ color: textMuted }}>#{item.sira_no}</span>
                                </div>
                                <div className="flex gap-3">
                                  <button onClick={() => { setEditingItem(item.id); setEditValues({ poz_kodu: item.poz_kodu, miktar: item.miktar, birim: item.birim, aciklama: item.aciklama }) }}
                                    className="text-xs font-semibold hover:underline" style={{ color: accent }}>Duzenle</button>
                                  <button onClick={() => deleteItem(item.id)} disabled={saving}
                                    className="text-xs hover:underline font-semibold disabled:opacity-50" style={{ color: '#DC2626' }}>Sil</button>
                                </div>
                              </div>
                              <p className="text-sm font-medium mb-1" style={{ color: navy }}>{item.aciklama}</p>
                              <div className="flex gap-4 text-xs" style={{ color: textMuted }}>
                                <span>Miktar: <b style={{ color: textSecondary }}>{item.miktar} {item.birim}</b></span>
                                <span>Birim: <b style={{ color: textSecondary }}>{item.birim_fiyat?.toLocaleString('tr-TR')} TL</b></span>
                                <span className="font-bold" style={{ color: '#1B7A5A' }}>Toplam: {item.toplam_tutar?.toLocaleString('tr-TR')} TL</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                    <div className="rounded-xl p-4 flex justify-between items-center" style={{ background: '#EEF0F8', border: `1px solid #D0D5E8` }}>
                      <span className="font-bold" style={{ color: navy }}>Genel Toplam</span>
                      <span className="font-bold text-xl" style={{ color: navy }}>{toplamTutar(secili.tutanak_items).toLocaleString('tr-TR')} TL</span>
                    </div>
                  </div>
                )}

                {/* Silme */}
                <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${borderColor}` }}>
                  {silmeOnay === secili.id ? (
                    <div className="rounded-xl p-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <p className="font-semibold text-sm mb-2" style={{ color: '#991B1B' }}>Bu tutanagi silmek istediginize emin misiniz?</p>
                      <p className="text-xs mb-3" style={{ color: '#B91C1C' }}>Bu islem geri alinamaz. Tutanak ve tum is kalemleri silinecektir.</p>
                      <p className="text-xs mb-2" style={{ color: '#991B1B' }}>Onaylamak icin tutanak numarasini yazin: <b>{secili.no}</b></p>
                      <input
                        value={silmeYazi}
                        onChange={e => setSilmeYazi(e.target.value)}
                        placeholder={secili.no || 'Tutanak no'}
                        className="w-full rounded-lg px-3 py-2 text-sm mb-3 bg-white focus:outline-none focus:ring-2 focus:ring-red-200"
                        style={{ color: navy, border: '1px solid #FECACA' }}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => tutanakSil(secili.id)} disabled={silmeYazi !== secili.no || siliniyor}
                          className="text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-20 disabled:cursor-not-allowed"
                          style={{ background: '#DC2626' }}>
                          {siliniyor ? 'Siliniyor...' : 'Evet, Sil'}
                        </button>
                        <button onClick={() => { setSilmeOnay(null); setSilmeYazi('') }}
                          className="bg-white px-4 py-2 rounded-lg text-sm font-semibold" style={{ color: textSecondary, border: `1px solid ${borderColor}` }}>
                          Vazgec
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setSilmeOnay(secili.id)} className="text-xs transition-colors" style={{ color: textMuted }}
                      onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                      onMouseLeave={e => e.currentTarget.style.color = textMuted}
                    >Tutanagi Sil</button>
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
