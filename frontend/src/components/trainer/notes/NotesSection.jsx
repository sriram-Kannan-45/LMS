import { useState, useEffect } from 'react'
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react'
import { API_BASE } from '../../../api/api'
import { colors } from '../../../theme/tokens'

function getAuthHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const token = user?.token || user?.accessToken || ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export default function NotesSection({ user }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const res = await fetch(`${API_BASE}/notes/trainer/notes`, {
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        })
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        if (!cancelled) setNotes(data.notes || data || [])
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  const handleAdd = async () => {
    if (!newNote.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/notes/trainer/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content: newNote.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setNotes(prev => [data.note || data, ...prev])
      setNewNote('')
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE}/notes/trainer/notes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch {
      // silent
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Poppins', sans-serif", margin: 0 }}>Notes & Resources</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '2px 0 0' }}>Private notes and teaching resources</p>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Write a note..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border-default)',
              fontSize: 14, fontFamily: 'inherit', resize: 'vertical', minHeight: 44,
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
            }}
          />
          <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !newNote.trim()}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileText size={32} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
          No notes yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map(note => (
            <div key={note.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{note.content}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                </div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(note.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
