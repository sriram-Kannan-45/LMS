import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, User, BookOpen, X, CheckCircle, Clock } from 'lucide-react'
import { useState } from 'react'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const courseStatus = (start, end) => {
  if (!start || !end) return { label: 'Self-paced', tone: 'primary' }
  const now = Date.now()
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (now < s) return { label: 'Upcoming', tone: 'violet' }
  if (now > e) return { label: 'Completed', tone: 'success' }
  return { label: 'In progress', tone: 'teal' }
}

export default function MyEnrollments({ enrollments = [], loading = false, onCancel }) {
  const [confirmId, setConfirmId] = useState(null)

  return (
    <div className="ac-stack">
      <div>
        <h2 className="ac-section-title">My Courses</h2>
        <p className="ac-section-subtitle">Courses you've joined • {enrollments.length} active</p>
      </div>

      {loading && enrollments.length === 0 && (
        <div className="ac-grid-2">
          {[1, 2].map((i) => (
            <div key={i} className="ac-card">
              <div className="ac-skeleton" style={{ height: 18, width: '60%', marginBottom: 12 }} />
              <div className="ac-skeleton" style={{ height: 12, width: '90%', marginBottom: 6 }} />
              <div className="ac-skeleton" style={{ height: 12, width: '70%' }} />
            </div>
          ))}
        </div>
      )}

      {!loading && enrollments.length === 0 && (
        <div className="ac-empty">
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'var(--academic-secondary-50)', color: 'var(--academic-secondary-600)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>You haven't joined any course yet</h3>
          <p style={{ fontSize: 14, color: 'var(--academic-text-muted)' }}>
            Browse the course catalogue and tap "Join Course" to enroll.
          </p>
        </div>
      )}

      {enrollments.length > 0 && (
        <div className="ac-grid-2">
          {enrollments.map((e, i) => {
            const status = courseStatus(e.startDate, e.endDate)
            return (
              <motion.article
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.24) }}
                whileHover={{ y: -2 }}
                className="ac-card"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'var(--academic-gradient-soft)', color: 'var(--academic-primary)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <BookOpen size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                      fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 700,
                      lineHeight: 1.3, color: 'var(--academic-text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {e.trainingTitle}
                    </h3>
                    <div className="flex items-center gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                      <span className={`ac-chip ac-chip-${status.tone}`}>{status.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--academic-text-muted)' }}>
                        Joined {fmtDate(e.enrolledAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--academic-text-secondary)', marginBottom: 14 }}>
                  <li className="flex items-center gap-2">
                    <User size={12} style={{ color: 'var(--academic-text-muted)' }} />
                    <span style={{ color: 'var(--academic-text-muted)' }}>Instructor:</span>
                    <span style={{ fontWeight: 600 }}>{e.trainerName || 'TBA'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Calendar size={12} style={{ color: 'var(--academic-text-muted)' }} />
                    <span>{fmtDate(e.startDate)} → {fmtDate(e.endDate)}</span>
                  </li>
                </ul>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmId(e.trainingId)}
                    className="ac-btn ac-btn-ghost ac-focus-ring"
                    style={{ color: 'var(--academic-danger)', fontSize: 12.5 }}
                  >
                    <X size={13} /> Leave
                  </button>
                </div>
              </motion.article>
            )
          })}
        </div>
      )}

      {/* Confirm leave modal */}
      <AnimatePresence>
        {confirmId != null && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setConfirmId(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
              backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 12, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--academic-surface)', borderRadius: 'var(--academic-radius-lg)',
                padding: 24, maxWidth: 420, width: '100%',
                boxShadow: 'var(--academic-shadow-pop)',
              }}
            >
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                Leave this course?
              </h3>
              <p style={{ fontSize: 13.5, color: 'var(--academic-text-secondary)', marginBottom: 20 }}>
                You can re-enroll later, but your progress in this enrollment will be lost.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="ac-btn ac-focus-ring" onClick={() => setConfirmId(null)}>Stay enrolled</button>
                <button
                  type="button"
                  className="ac-btn ac-focus-ring"
                  style={{ background: 'var(--academic-danger)', color: '#fff', borderColor: 'transparent' }}
                  onClick={() => { onCancel?.(confirmId); setConfirmId(null) }}
                >
                  Leave course
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
