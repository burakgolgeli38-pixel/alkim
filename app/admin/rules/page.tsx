'use client'

import { useState, useEffect, useCallback } from 'react'

interface Rule {
  id: string
  keywords: string[]
  exclude_keywords: string[] | null
  poz_kodu: string
  priority: number
  source: string
  example_aciklama: string | null
  hit_count: number
  is_active: boolean
}

const pozColors: Record<string, string> = {
  'A': '#ef4444', 'B': '#f97316', 'C': '#eab308', 'D': '#84cc16',
  'E': '#22c55e', 'F': '#14b8a6', 'G': '#06b6d4', 'H': '#3b82f6',
  'I': '#6366f1', 'K': '#8b5cf6', 'L': '#a855f7', 'N': '#d946ef',
  'O': '#ec4899', 'R': '#f43f5e', 'S': '#6b7280',
}

function getPozColor(poz: string) {
  const letter = poz.charAt(0)
  return pozColors[letter] || '#6b7280'
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [filterPoz, setFilterPoz] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [testResult, setTestResult] = useState<{ total: number; correct: number; accuracy: number; mismatches: Array<{ aciklama: string; expected: string; got: string }> } | null>(null)

  // Form state
  const [formKeywords, setFormKeywords] = useState('')
  const [formExclude, setFormExclude] = useState('')
  const [formPozKodu, setFormPozKodu] = useState('')
  const [formPriority, setFormPriority] = useState(100)
  const [formExample, setFormExample] = useState('')

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterPoz) params.set('poz_kodu', filterPoz)
      if (filterSource) params.set('source', filterSource)
      const res = await fetch(`/api/rules?${params.toString()}`)
      const data = await res.json()
      setRules(data.rules || [])
    } catch {
      showMsg('Kurallar yuklenemedi', 'error')
    }
    setLoading(false)
  }, [filterPoz, filterSource])

  useEffect(() => { loadRules() }, [loadRules])

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const clearCache = async () => {
    await fetch('/api/rules/cache', { method: 'POST' })
  }

  const saveRule = async () => {
    if (!formKeywords || !formPozKodu) return showMsg('Keywords ve POZ kodu gerekli', 'error')

    const body = {
      keywords: formKeywords.split(',').map(k => k.trim()).filter(Boolean),
      exclude_keywords: formExclude ? formExclude.split(',').map(k => k.trim()).filter(Boolean) : null,
      poz_kodu: formPozKodu.toUpperCase(),
      priority: formPriority,
      example_aciklama: formExample || null,
    }

    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      showMsg('Kural eklendi')
      setShowAddForm(false)
      resetForm()
      await clearCache()
      loadRules()
    } else {
      const data = await res.json()
      showMsg(data.error || 'Hata', 'error')
    }
  }

  const updateRule = async () => {
    if (!editingRule) return

    const res = await fetch('/api/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingRule.id,
        keywords: editingRule.keywords,
        exclude_keywords: editingRule.exclude_keywords,
        poz_kodu: editingRule.poz_kodu,
        priority: editingRule.priority,
      }),
    })

    if (res.ok) {
      showMsg('Kural guncellendi')
      setEditingRule(null)
      await clearCache()
      loadRules()
    }
  }

  const toggleActive = async (rule: Rule) => {
    await fetch('/api/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    })
    await clearCache()
    loadRules()
  }

  const deleteRule = async (id: string) => {
    if (!confirm('Bu kurali silmek istediginize emin misiniz?')) return
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
    showMsg('Kural silindi')
    await clearCache()
    loadRules()
  }

  const resetForm = () => {
    setFormKeywords('')
    setFormExclude('')
    setFormPozKodu('')
    setFormPriority(100)
    setFormExample('')
  }

  const handleTestUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    showMsg('Test ediliyor...')
    const res = await fetch('/api/test-rules', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.error) {
      showMsg(data.error, 'error')
    } else {
      setTestResult(data)
      showMsg(`Dogruluk: %${data.accuracy} (${data.correct}/${data.total})`)
    }
  }

  const handleImportUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    showMsg('Excel analiz ediliyor...')
    const res = await fetch('/api/import-rules', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.error) {
      showMsg(data.error, 'error')
    } else {
      showMsg(`${data.stats?.new_rules || 0} yeni kural onerisi bulundu`)
    }
  }

  const uniquePozCodes = [...new Set(rules.map(r => r.poz_kodu))].sort()
  const filteredRules = rules

  const s = {
    page: { padding: '24px', maxWidth: '1400px', margin: '0 auto' } as React.CSSProperties,
    card: { background: 'var(--foreground)', color: 'var(--background)', borderRadius: '12px', padding: '20px', marginBottom: '16px', opacity: 0.05 } as React.CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' as const, gap: '12px' },
    btn: (bg: string) => ({ padding: '8px 16px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }) as React.CSSProperties,
    btnOutline: { padding: '6px 12px', background: 'transparent', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'inherit' } as React.CSSProperties,
    input: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: 'inherit', fontSize: '14px', width: '100%', boxSizing: 'border-box' as const },
    select: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #444', background: '#1a1a1a', color: '#eee', fontSize: '14px' },
    badge: (color: string) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: color + '22', color, border: `1px solid ${color}55` }) as React.CSSProperties,
    kwBadge: { display: 'inline-block', padding: '2px 8px', margin: '2px', borderRadius: '6px', background: '#3b82f622', color: '#60a5fa', border: '1px solid #3b82f644', fontSize: '12px' },
    exBadge: { display: 'inline-block', padding: '2px 8px', margin: '2px', borderRadius: '6px', background: '#ef444422', color: '#f87171', border: '1px solid #ef444444', fontSize: '12px' },
    table: { width: '100%', borderCollapse: 'collapse' as const },
    th: { padding: '12px 10px', textAlign: 'left' as const, borderBottom: '2px solid #333', fontSize: '13px', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
    td: { padding: '10px', borderBottom: '1px solid #222' },
    section: { background: '#111', borderRadius: '12px', padding: '20px', marginTop: '24px', border: '1px solid #222' },
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>POZ Eslestirme Kurallari</h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '14px' }}>
            Toplam {rules.length} kural | Dinamik eslestirme motoru
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a href="/admin" style={{ ...s.btn('#374151'), textDecoration: 'none' }}>Ana Panel</a>
          <button onClick={() => { setShowAddForm(!showAddForm); resetForm() }} style={s.btn('#2563eb')}>+ Yeni Kural</button>
          <button onClick={async () => { await clearCache(); showMsg('Cache temizlendi') }} style={s.btn('#d97706')}>Cache Temizle</button>
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterPoz} onChange={e => setFilterPoz(e.target.value)} style={s.select}>
          <option value="">Tum POZ Kodlari</option>
          {uniquePozCodes.map(poz => <option key={poz} value={poz}>{poz}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={s.select}>
          <option value="">Tum Kaynaklar</option>
          <option value="migrated">Migrated</option>
          <option value="manual">Manual</option>
          <option value="learned">Learned</option>
        </select>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{ ...s.section, borderColor: '#2563eb44' }}>
          <h3 style={{ margin: '0 0 16px', color: '#60a5fa' }}>Yeni Kural Ekle</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Keywords (virgul ile)*</label>
              <input value={formKeywords} onChange={e => setFormKeywords(e.target.value)} placeholder="surme, izalasyon" style={s.input} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Exclude (opsiyonel)</label>
              <input value={formExclude} onChange={e => setFormExclude(e.target.value)} placeholder="temiz, cop" style={s.input} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>POZ Kodu*</label>
              <input value={formPozKodu} onChange={e => setFormPozKodu(e.target.value)} placeholder="C-07" style={s.input} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Priority (dusuk = once)</label>
              <input type="number" value={formPriority} onChange={e => setFormPriority(parseInt(e.target.value) || 100)} style={s.input} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Ornek Aciklama</label>
              <input value={formExample} onChange={e => setFormExample(e.target.value)} placeholder="SURME IZALASYON 40M" style={s.input} />
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={saveRule} style={s.btn('#16a34a')}>Kaydet</button>
            <button onClick={() => setShowAddForm(false)} style={s.btn('#374151')}>Iptal</button>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editingRule && (
        <div style={{ ...s.section, borderColor: '#eab30844' }}>
          <h3 style={{ margin: '0 0 16px', color: '#fbbf24' }}>Kural Duzenle</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Keywords</label>
              <input
                value={editingRule.keywords.join(', ')}
                onChange={e => setEditingRule({ ...editingRule, keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })}
                style={s.input}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Exclude</label>
              <input
                value={(editingRule.exclude_keywords || []).join(', ')}
                onChange={e => setEditingRule({ ...editingRule, exclude_keywords: e.target.value ? e.target.value.split(',').map(k => k.trim()).filter(Boolean) : null })}
                style={s.input}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>POZ Kodu</label>
              <input
                value={editingRule.poz_kodu}
                onChange={e => setEditingRule({ ...editingRule, poz_kodu: e.target.value.toUpperCase() })}
                style={s.input}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Priority</label>
              <input
                type="number"
                value={editingRule.priority}
                onChange={e => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 100 })}
                style={{ ...s.input, width: '80px' }}
              />
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={updateRule} style={s.btn('#2563eb')}>Guncelle</button>
            <button onClick={() => setEditingRule(null)} style={s.btn('#374151')}>Iptal</button>
          </div>
        </div>
      )}

      {/* Rules Table */}
      {loading ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Yukleniyor...</p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #222' }}>
          <table style={s.table}>
            <thead>
              <tr style={{ background: '#111' }}>
                <th style={{ ...s.th, width: '50px' }}>P</th>
                <th style={{ ...s.th, width: '80px' }}>POZ</th>
                <th style={s.th}>Keywords</th>
                <th style={s.th}>Exclude</th>
                <th style={s.th}>Ornek</th>
                <th style={{ ...s.th, width: '50px', textAlign: 'center' }}>Hit</th>
                <th style={{ ...s.th, width: '80px', textAlign: 'center' }}>Kaynak</th>
                <th style={{ ...s.th, width: '60px', textAlign: 'center' }}>Durum</th>
                <th style={{ ...s.th, width: '120px', textAlign: 'center' }}>Islem</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id} style={{ opacity: rule.is_active ? 1 : 0.4, transition: 'opacity 0.2s' }}>
                  <td style={{ ...s.td, fontFamily: 'monospace', color: '#888' }}>{rule.priority}</td>
                  <td style={s.td}>
                    <span style={s.badge(getPozColor(rule.poz_kodu))}>{rule.poz_kodu}</span>
                  </td>
                  <td style={s.td}>
                    {rule.keywords.map((kw, i) => (
                      <span key={i} style={s.kwBadge}>{kw}</span>
                    ))}
                  </td>
                  <td style={s.td}>
                    {rule.exclude_keywords && rule.exclude_keywords.length > 0
                      ? rule.exclude_keywords.map((ex, i) => <span key={i} style={s.exBadge}>{ex}</span>)
                      : <span style={{ color: '#444' }}>-</span>
                    }
                  </td>
                  <td style={{ ...s.td, fontSize: '13px', color: '#888', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rule.example_aciklama || <span style={{ color: '#333' }}>-</span>}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center', fontFamily: 'monospace', color: rule.hit_count > 0 ? '#4ade80' : '#444' }}>
                    {rule.hit_count}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '12px',
                      background: rule.source === 'learned' ? '#22c55e22' : rule.source === 'migrated' ? '#eab30822' : '#6b728022',
                      color: rule.source === 'learned' ? '#4ade80' : rule.source === 'migrated' ? '#fbbf24' : '#9ca3af',
                    }}>
                      {rule.source}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <button onClick={() => toggleActive(rule)} style={{
                      ...s.btnOutline,
                      borderColor: rule.is_active ? '#22c55e55' : '#ef444455',
                      color: rule.is_active ? '#4ade80' : '#f87171',
                      fontSize: '12px', padding: '3px 10px',
                    }}>
                      {rule.is_active ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button onClick={() => setEditingRule(rule)} style={{ ...s.btnOutline, fontSize: '12px', padding: '3px 10px' }}>
                        Duzenle
                      </button>
                      <button onClick={() => deleteRule(rule.id)} style={{ ...s.btnOutline, borderColor: '#ef444455', color: '#f87171', fontSize: '12px', padding: '3px 10px' }}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Excel Import & Test */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
        <div style={s.section}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Excel&apos;den Kural Ogren</h3>
          <p style={{ color: '#666', fontSize: '13px', margin: '0 0 12px' }}>
            Referans Excel yukle, sistem aciklama-POZ eslestirilmelerini analiz edip yeni kurallar onersin.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImportUpload(f) }}
            style={{ fontSize: '13px' }}
          />
        </div>

        <div style={s.section}>
          <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Kural Dogruluk Testi</h3>
          <p style={{ color: '#666', fontSize: '13px', margin: '0 0 12px' }}>
            Bilinen eslestirmeler iceren Excel yukle, dogruluk raporu oluştursun.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleTestUpload(f) }}
            style={{ fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Test Results */}
      {testResult && (
        <div style={{ ...s.section, marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Test Sonuclari</h3>
            <button onClick={() => setTestResult(null)} style={s.btn('#374151')}>Kapat</button>
          </div>
          <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
            <div>
              <span style={{ color: '#888', fontSize: '13px' }}>Toplam</span>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{testResult.total}</div>
            </div>
            <div>
              <span style={{ color: '#888', fontSize: '13px' }}>Dogru</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#4ade80' }}>{testResult.correct}</div>
            </div>
            <div>
              <span style={{ color: '#888', fontSize: '13px' }}>Dogruluk</span>
              <div style={{ fontSize: '24px', fontWeight: 700, color: testResult.accuracy >= 90 ? '#4ade80' : '#f87171' }}>%{testResult.accuracy}</div>
            </div>
          </div>
          {testResult.mismatches.length > 0 && (
            <>
              <h4 style={{ color: '#f87171', margin: '0 0 8px' }}>Yanlis Eslestirmeler ({testResult.mismatches.length})</h4>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Aciklama</th>
                      <th style={{ ...s.th, width: '80px' }}>Beklenen</th>
                      <th style={{ ...s.th, width: '80px' }}>Sonuc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResult.mismatches.map((m, i) => (
                      <tr key={i}>
                        <td style={{ ...s.td, fontSize: '13px' }}>{m.aciklama}</td>
                        <td style={s.td}><span style={s.badge('#22c55e')}>{m.expected}</span></td>
                        <td style={s.td}><span style={s.badge('#ef4444')}>{m.got}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
