import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FolderUp, FileText, CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react'
import ResourceUploader from './ResourceUploader'
import ResourceList from './ResourceList'
import EditResourceModal from './EditResourceModal'
import ResourcePreviewModal from './ResourcePreviewModal'
import useTrainerNotes from '../../../hooks/useTrainerNotes'
import { useToast } from '../../Toast'
import { API_BASE } from '../../../api/api'

/**
 * NotesSection — top-level Trainer "Notes & Resources" page.
 *
 * Layout: stacked.
 *   1. Hero header (title, subtitle, status counters)
 *   2. Uploader card (drag-drop + progress)
 *   3. Resource library (search/filter + grid of cards)
 *   4. Edit modal + Preview modal (rendered when active)
 *
 * Reads/writes through useTrainerNotes which uses the existing
 * /api/notes endpoints (no backend behaviour changes).
 */
export default function NotesSection({ user }) {
  const { success, error: showError, info } = useToast()
  const { notes, loading, refresh, upload, update, remove } = useTrainerNotes(user)

  const [trainings, setTrainings] = useState([])
  const [editing, setEditing] = useState(null)
  const [previewing, setPreviewing] = useState(null)

  // Pull the trainer's trainings once for the dropdown selectors
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user?.token) return
      try {
        const r = await fetch(`${API_BASE}/trainer/trainings`, {
          headers: { Authorization: `Bearer ${user.token}` },
        })
        const d = await r.json().catch(() => ({}))
        if (!cancelled) setTrainings(Array.isArray(d.trainings) ? d.trainings : [])
      } catch {
        /* non-fatal — selector just shows "General" */
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const counts = {
    total: notes.length,
    pending: notes.filter((n) => n.status === 'PENDING').length,
    approved: notes.filter((n) => n.status === 'APPROVED').length,
    rejected: notes.filter((n) => n.status === 'REJECTED').length,
  }

  const handleUpload = async ({ formData, onProgress }) => {
    return upload({ formData, onProgress })
  }

  const handleSaveEdit = async ({ formData, onProgress }) => {
    if (!editing) return
    await update(editing.id, { formData, onProgress })
    success('Resource updated.')
    refresh() // pick up status reset if file replaced
  }

  const handleDelete = async (note) => {
    const ok = window.confirm(`Delete "${note.title}"? This cannot be undone.`)
    if (!ok) return
    try {
      await remove(note.id)
      success('Resource deleted.')
    } catch (e) {
      showError(e.message || 'Delete failed')
    }
  }

  return (
    <div className="tr-notes">
      {/* HERO */}
      <header className="tr-notes__header">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="tr-notes__title-icon">
            <FolderUp size={22} />
          </span>
          <div>
            <h2 className="tr-notes__title" style={{ display: 'block' }}>
              Notes &amp; Resources
            </h2>
            <p className="tr-notes__subtitle">
              Share PDFs, slides, videos, and other learning materials with your participants.
            </p>
          </div>
        </div>

        {/* Status counters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Counter icon={FileText}    color="#6366f1" label="Total"    value={counts.total} />
          <Counter icon={Clock}       color="#f59e0b" label="Pending"  value={counts.pending} />
          <Counter icon={CheckCircle2} color="#10b981" label="Approved" value={counts.approved} />
          {counts.rejected > 0 && (
            <Counter icon={AlertTriangle} color="#ef4444" label="Rejected" value={counts.rejected} />
          )}
        </div>
      </header>

      {/* UPLOADER */}
      <ResourceUploader
        trainings={trainings}
        onUpload={handleUpload}
        onSuccess={() => success('Uploaded! Pending admin approval.')}
        onError={(msg) => showError(msg)}
      />

      {/* LIBRARY */}
      <section>
        <h3 style={{
          fontFamily: "'Outfit', system-ui, sans-serif",
          fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
          margin: '0 0 12px 0', color: 'var(--tn-text, #0f172a)',
        }}>
          Library
        </h3>
        <ResourceList
          notes={notes}
          loading={loading}
          onPreview={(n) => setPreviewing(n)}
          onEdit={(n) => setEditing(n)}
          onDelete={handleDelete}
        />
      </section>

      {/* MODALS */}
      <EditResourceModal
        open={!!editing}
        note={editing}
        trainings={trainings}
        onClose={() => setEditing(null)}
        onSave={handleSaveEdit}
      />
      <ResourcePreviewModal
        note={previewing}
        onClose={() => setPreviewing(null)}
      />
    </div>
  )
}

function Counter({ icon: Icon, color, label, value }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.65)',
        border: '1px solid rgba(226,232,240,0.85)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <span
        style={{
          width: 28, height: 28, borderRadius: 8,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: `${color}1A`, color,
        }}
      >
        <Icon size={14} />
      </span>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 800, fontSize: 16 }}>
          {value}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: '#64748b' }}>
          {label}
        </div>
      </div>
    </motion.div>
  )
}
