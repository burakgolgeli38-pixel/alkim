'use client'

import { useState, useEffect, useCallback } from 'react'

interface MagazaRecord {
  id: string
  kod: string
  magaza_adi: string
  idari_bolge: string
  idari_isler_sorumlusu: string
}

export default function MagazalarPage() {
  const [magazalar, setMagazalar] = useState<MagazaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [arama, setArama] = useState('')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/magazalar')
      const data = await res.json()
      setMagazalar(data.magazalar || [])
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
      const res = await fetch('/api/magazalar', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) {
        showMsg(data.error, 'error')
      } else {
        showMsg(`${data.stats.total} magaza yuklendi`)
        loadData()
      }
    } catch {
      showMsg('Yukleme hatasi', 'error')
    }
    setUploading(false)
  }

  const filtered = arama
    ? magazalar.filter(m =>
        [m.kod, m.magaza_adi, m.idari_bolge, m.idari_isler_sorumlusu]
          .join(' ').toLowerCase().includes(arama.toLowerCase())
      )
    : magazalar

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Magaza Referans Verileri</h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '14px' }}>
            {magazalar.length} magaza kayitli
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/admin" style={{ padding: '8px 16px', background: '#374151', color: '#fff', border: 'none', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>Ana Panel</a>
          <a href="/admin/rules" style={{ padding: '8px 16px', background: '#374151', color: '#fff', border: 'none', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>POZ Kurallari</a>
          <a href="/admin/uygulamacilar" style={{ padding: '8px 16px', background: '#374151', color: '#fff', border: 'none', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>Uygulamacilar</a>
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
        <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Magaza Excel Yukle</h3>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 12px' }}>
          KOD, MAGAZA ADI, IDARI BOLGE, IDARI ISLER SORUMLUSU sutunlari olan Excel yukleyin.
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
          placeholder="Magaza kodu, isim, bolge veya sorumlu ara..."
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: 'inherit', fontSize: '14px', width: '350px' }}
        />
        {arama && <span style={{ color: '#888', fontSize: '13px', marginLeft: '12px' }}>{filtered.length} sonuc</span>}
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Yukleniyor...</p>
      ) : magazalar.length === 0 ? (
        <div style={{ background: '#111', borderRadius: '12px', padding: '40px', border: '1px solid #222', textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '16px', margin: '0 0 8px' }}>Henuz magaza verisi yuklenmemis</p>
          <p style={{ color: '#555', fontSize: '14px', margin: 0 }}>Yukaridaki alandan Excel dosyasini yukleyin</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #222' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#111' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #333', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Kod</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #333', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Magaza Adi</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #333', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Idari Bolge</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #333', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Idari Isler Sorumlusu</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#60a5fa' }}>{m.kod}</td>
                  <td style={{ padding: '8px 12px' }}>{m.magaza_adi}</td>
                  <td style={{ padding: '8px 12px', color: '#fbbf24' }}>{m.idari_bolge}</td>
                  <td style={{ padding: '8px 12px', color: '#a78bfa' }}>{m.idari_isler_sorumlusu}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <p style={{ color: '#888', textAlign: 'center', padding: '12px', fontSize: '13px' }}>
              Ilk 100 sonuc gosteriliyor (toplam {filtered.length})
            </p>
          )}
        </div>
      )}
    </div>
  )
}
