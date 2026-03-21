'use client'

import { useState, useEffect, useCallback } from 'react'

interface Group {
  id: string
  group_name: string
  members: string[]
  is_active: boolean
}

export default function UygulamacilarPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const [formName, setFormName] = useState('')
  const [formMembers, setFormMembers] = useState('')

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/uygulamaci-groups')
      const data = await res.json()
      setGroups(data.groups || [])
    } catch {
      showMsg('Gruplar yuklenemedi', 'error')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const saveGroup = async () => {
    if (!formName || !formMembers) return showMsg('Grup adi ve uyeler gerekli', 'error')

    const res = await fetch('/api/uygulamaci-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_name: formName,
        members: formMembers.split(',').map(m => m.trim()).filter(Boolean),
      }),
    })

    if (res.ok) {
      showMsg('Grup eklendi')
      setShowAddForm(false)
      setFormName('')
      setFormMembers('')
      loadGroups()
    } else {
      const data = await res.json()
      showMsg(data.error || 'Hata', 'error')
    }
  }

  const updateGroup = async () => {
    if (!editingGroup) return

    const res = await fetch('/api/uygulamaci-groups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingGroup.id,
        group_name: editingGroup.group_name,
        members: editingGroup.members,
      }),
    })

    if (res.ok) {
      showMsg('Grup guncellendi')
      setEditingGroup(null)
      loadGroups()
    }
  }

  const deleteGroup = async (id: string) => {
    if (!confirm('Bu grubu silmek istediginize emin misiniz?')) return
    await fetch(`/api/uygulamaci-groups?id=${id}`, { method: 'DELETE' })
    showMsg('Grup silindi')
    loadGroups()
  }

  const s = {
    page: { padding: '24px', maxWidth: '1000px', margin: '0 auto' } as React.CSSProperties,
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' as const, gap: '12px' },
    btn: (bg: string) => ({ padding: '8px 16px', background: bg, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }) as React.CSSProperties,
    btnOutline: { padding: '6px 12px', background: 'transparent', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'inherit' } as React.CSSProperties,
    input: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #444', background: 'transparent', color: 'inherit', fontSize: '14px', width: '100%', boxSizing: 'border-box' as const },
    section: { background: '#111', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #222' },
    memberBadge: { display: 'inline-block', padding: '4px 12px', margin: '3px', borderRadius: '20px', background: '#2563eb22', color: '#60a5fa', border: '1px solid #2563eb44', fontSize: '13px' },
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Uygulamaci Gruplari</h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '14px' }}>
            Tutanaktaki firma sorumlusu isimlerini grupla
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/admin" style={{ ...s.btn('#374151'), textDecoration: 'none' }}>Ana Panel</a>
          <a href="/admin/rules" style={{ ...s.btn('#374151'), textDecoration: 'none' }}>Kurallar</a>
          <button onClick={() => setShowAddForm(!showAddForm)} style={s.btn('#2563eb')}>+ Yeni Grup</button>
        </div>
      </div>

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

      {/* Add Form */}
      {showAddForm && (
        <div style={{ ...s.section, borderColor: '#2563eb44' }}>
          <h3 style={{ margin: '0 0 16px', color: '#60a5fa' }}>Yeni Grup Ekle</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Grup Adi*</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="DIZMANLAR" style={s.input} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Uyeler (virgul ile ayir)*</label>
              <input value={formMembers} onChange={e => setFormMembers(e.target.value)} placeholder="Enes Dizman, Muhammed Dizman" style={s.input} />
              <p style={{ fontSize: '12px', color: '#555', margin: '4px 0 0' }}>Tutanaktaki isimleri yazdiginiz gibi girin</p>
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={saveGroup} style={s.btn('#16a34a')}>Kaydet</button>
            <button onClick={() => setShowAddForm(false)} style={s.btn('#374151')}>Iptal</button>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editingGroup && (
        <div style={{ ...s.section, borderColor: '#eab30844' }}>
          <h3 style={{ margin: '0 0 16px', color: '#fbbf24' }}>Grup Duzenle: {editingGroup.group_name}</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Grup Adi</label>
              <input
                value={editingGroup.group_name}
                onChange={e => setEditingGroup({ ...editingGroup, group_name: e.target.value })}
                style={s.input}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#888', display: 'block', marginBottom: '4px' }}>Uyeler (virgul ile)</label>
              <input
                value={editingGroup.members.join(', ')}
                onChange={e => setEditingGroup({ ...editingGroup, members: e.target.value.split(',').map(m => m.trim()).filter(Boolean) })}
                style={s.input}
              />
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button onClick={updateGroup} style={s.btn('#2563eb')}>Guncelle</button>
            <button onClick={() => setEditingGroup(null)} style={s.btn('#374151')}>Iptal</button>
          </div>
        </div>
      )}

      {/* Groups List */}
      {loading ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>Yukleniyor...</p>
      ) : groups.length === 0 ? (
        <div style={{ ...s.section, textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#888', fontSize: '16px', margin: '0 0 8px' }}>Henuz grup olusturulmamis</p>
          <p style={{ color: '#555', fontSize: '14px', margin: 0 }}>
            &quot;+ Yeni Grup&quot; butonuyla ilk grubu olusturun
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {groups.map(group => (
            <div key={group.id} style={{ ...s.section, opacity: group.is_active ? 1 : 0.4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#60a5fa' }}>{group.group_name}</h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setEditingGroup(group)} style={s.btnOutline}>Duzenle</button>
                  <button onClick={() => deleteGroup(group.id)} style={{ ...s.btnOutline, borderColor: '#ef444455', color: '#f87171' }}>Sil</button>
                </div>
              </div>
              <div>
                {group.members.map((member, i) => (
                  <span key={i} style={s.memberBadge}>{member}</span>
                ))}
              </div>
              <p style={{ color: '#555', fontSize: '12px', margin: '8px 0 0' }}>{group.members.length} uye</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
