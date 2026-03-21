'use client'

import { useState, useEffect, useCallback } from 'react'

interface BirimFiyatRecord {
  id: string
  poz_no: string
  poz_tanimi: string
  poz_birim_fiyat_tarifesi: string
  marka_model: string
  birim: string
  birim_fiyat: number
}

export default function BirimFiyatlarPage() {
  const [fiyatlar, setFiyatlar] = useState<BirimFiyatRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [arama, setArama] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/birim-fiyatlar')
      const data = await res.json()
      setFiyatlar(data.fiyatlar || [])
    } catch {
      showMsg('Veriler yuklenemedi', 'error')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/birim-fiyatlar', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) {
        showMsg(data.error, 'error')
      } else {
        showMsg(data.message)
        loadData()
      }
    } catch {
      showMsg('Yukleme hatasi', 'error')
    }
    setUploading(false)
  }

  const filtered = arama
    ? fiyatlar.filter(f =>
        [f.poz_no, f.poz_tanimi, f.birim, String(f.birim_fiyat)]
          .join(' ').toLowerCase().includes(arama.toLowerCase())
      )
    : fiyatlar

  const formatPrice = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Birim Fiyatlar (POZ Fiyat Listesi)</h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '14px' }}>
            {fiyatlar.length} POZ kodu kayitli | POZ kodu → birim fiyat eslestirmesi
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/admin" style={{ padding: '8px 16px', background: '#374151', color: '#fff', border: 'none', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>Ana Panel</a>
          <a href="/admin/rules" style={{ padding: '8px 16px', background: '#374151', color: '#fff', border: 'none', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>POZ Kurallari</a>
          <a href="/admin/magazalar" style={{ padding: '8px 16px', background: '#374151', color: '#fff', border: 'none', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>Magazalar</a>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: message.type === 'success' ? '#052e1622' : '#2d020822',
          border: `1px solid ${message.type === 'success' ? '#22c55e44' : '#ef444444'}`,
          color: message.type === 'success' ? '#4ade80' : '#f87171',
        }}>
          {message.text}
        </div>
      )}

      {/* Excel Upload */}
      <div style={{ background: '#111', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid #222' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Birim Fiyat Excel Yukle</h3>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 12px' }}>
          POZ NO, POZ TANIMI, BİRİM, BİRİM FİYAT sutunlari olan Excel yukleyin.
          &quot;BİRİM FİYATLAR&quot; sheeti otomatik bulunur.
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
            disabled={uploading}
            style={{ fontSize: '13px' }}
          />
          {uploading && <span style={{ color: '#fbbf24', fontSize: '13px' }}>Yukleniyor...</span>}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          value={arama}
          onChange={e => setArama(e.target.value)}
          placeholder="POZ no veya tanim ara... (ornek: C-07, izolasyon)"
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: 'inherit', fontSize: '14px', width: '350px' }}
        />
        {arama && <span style={{ color: '#888', fontSize: '13px', marginLeft: '12px' }}>{filtered.length} sonuc</span>}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Yukleniyor...</p>
      ) : fiyatlar.length === 0 ? (
        <div style={{ background: '#111', borderRadius: '12px', padding: '40px', border: '1px solid #222', textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '16px', margin: '0 0 8px' }}>Henuz birim fiyat yuklenmemis</p>
          <p style={{ color: '#555', fontSize: '14px', margin: 0 }}>Yukaridaki alandan birim fiyat Excel dosyasini yukleyin</p>
          <p style={{ color: '#555', fontSize: '13px', margin: '8px 0 0' }}>
            Alternatif: Mevcut JSON verisi ({fiyatlar.length === 0 ? 'bos' : fiyatlar.length}) kullanilabilir
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #222' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#111' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #333', fontSize: '12px', color: '#888', textTransform: 'uppercase', width: '80px' }}>POZ No</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #333', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Tanimi</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #333', fontSize: '12px', color: '#888', textTransform: 'uppercase', width: '80px' }}>Birim</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #333', fontSize: '12px', color: '#888', textTransform: 'uppercase', width: '120px' }}>Birim Fiyat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ background: '#1e3a5f', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{f.poz_no}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>{f.poz_tanimi}</td>
                  <td style={{ padding: '8px 12px', color: '#888' }}>{f.birim}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#4ade80', fontFamily: 'monospace' }}>{formatPrice(f.birim_fiyat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p style={{ color: '#888', textAlign: 'center', padding: '12px', fontSize: '13px' }}>
              Ilk 200 sonuc gosteriliyor (toplam {filtered.length})
            </p>
          )}
        </div>
      )}
    </div>
  )
}
