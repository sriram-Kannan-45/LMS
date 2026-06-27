import { motion } from 'framer-motion'
import { Calendar, User, Users, CheckCircle, XCircle, AlertCircle, Search, BookOpen } from 'lucide-react'
import { useMemo, useState } from 'react'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

/**
 * AvailableCourses — student-facing course catalogue.
 * Light academic theme. Uses real data passed in via props (no fetches here).
 */
export default function AvailableCourses({
  trainings = [],
  enrollments = [],
  loading = false,
  onEnroll,
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'open' | 'enrolled'

  const isEnrolled = (id) => enrollments.some((e) => e.trainingId === id)

  const filtered = useMemo(() => {
    return trainings.filter((t) => {
      const enrolled = isEnrolled(t.id)
      const full = t.isFull
      if (filter === 'open' && (enrolled || full)) return false
      if (filter === 'enrolled' && !enrolled) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.title?.toLowerCase().includes(q) ||
          t.trainerName?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
        )
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainings, enrollments, search, filter])

  return (
    <div className="ac-stack">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="ac-section-title">Explore Trainings</h2>
          <p className="ac-section-subtitle">Discover trainings created by your instructors</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" style={{ minWidth: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--academic-text-muted)' }} />
            <input
              type="search"
              placeholder="Search trainings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ac-input ac-focus"
              style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
              aria-label="Search trainings"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--academic-bg-soft)', border: '1px solid var(--academic-border)' }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'open', label: 'Open' },
              { key: 'enrolled', label: 'Joined' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="ac-focus-ring"
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: filter === f.key ? 'var(--academic-surface)' : 'transparent',
                  color: filter === f.key ? 'var(--academic-primary-700)' : 'var(--academic-text-secondary)',
                  boxShadow: filter === f.key ? 'var(--academic-shadow-xs)' : 'none',
                  transition: 'all 200ms ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && trainings.length === 0 && (
        <div className="ac-grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ac-card" style={{ minHeight: 240 }}>
              <div className="ac-skeleton" style={{ height: 18, width: '70%', marginBottom: 12 }} />
              <div className="ac-skeleton" style={{ height: 12, width: '95%', marginBottom: 6 }} />
              <div className="ac-skeleton" style={{ height: 12, width: '80%', marginBottom: 24 }} />
              <div className="ac-skeleton" style={{ height: 8, width: '100%', marginBottom: 16 }} />
              <div className="ac-skeleton" style={{ height: 36, width: '100%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="ac-empty">
          <div
            style={{
              width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
              background: 'var(--academic-primary-50)', color: 'var(--academic-primary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <BookOpen size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--academic-text)', marginBottom: 6 }}>
            {trainings.length === 0 ? 'No trainings available yet' : 'No matches'}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--academic-text-muted)' }}>
            {trainings.length === 0
              ? 'Your instructor will publish trainings here. Check back soon!'
              : 'Try adjusting your search or filter.'}
          </p>
        </div>
      )}

      {/* Course grid */}
      {filtered.length > 0 && (
        <div className="ac-grid-3">
          {filtered.map((t, i) => {
            const enrolled = isEnrolled(t.id)
            const full = t.isFull
            const pct = t.capacity ? Math.round(((t.enrolledCount || 0) / t.capacity) * 100) : null

            return (
              <motion.article
                key={t.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                whileHover={{ y: -2 }}
                className="ac-card"
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'var(--academic-gradient-soft)',
                      color: 'var(--academic-primary)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <BookOpen size={18} />
                  </div>
                  {enrolled && (
                    <span className="ac-chip ac-chip-success">
                      <CheckCircle size={11} /> Joined
                    </span>
                  )}
                  {full && !enrolled && (
                    <span className="ac-chip ac-chip-danger">
                      <XCircle size={11} /> Full
                    </span>
                  )}
                </div>

                <h3 style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 17, fontWeight: 700, lineHeight: 1.3,
                  color: 'var(--academic-text)', marginBottom: 8,
                }}>
                  {t.title}
                </h3>
                <p style={{
                  fontSize: 13, lineHeight: 1.5, color: 'var(--academic-text-secondary)',
                  marginBottom: 16, flex: 1,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {t.description || 'No description provided yet.'}
                </p>

                <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, fontSize: 12.5, color: 'var(--academic-text-secondary)' }}>
                  <li className="flex items-center gap-2">
                    <User size={12} style={{ color: 'var(--academic-text-muted)' }} />
                    <span style={{ color: 'var(--academic-text-muted)' }}>Instructor:</span>
                    <span style={{ fontWeight: 600, color: 'var(--academic-text)' }}>{t.trainerName || 'TBA'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Calendar size={12} style={{ color: 'var(--academic-text-muted)' }} />
                    <span>{fmtDate(t.startDate)} → {fmtDate(t.endDate)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Users size={12} style={{ color: 'var(--academic-text-muted)' }} />
                    <span>{t.enrolledCount ?? 0}{t.capacity ? ` / ${t.capacity}` : ''} enrolled</span>
                  </li>
                </ul>

                {pct !== null && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 11, color: 'var(--academic-text-muted)', marginBottom: 4,
                    }}>
                      <span>Capacity</span>
                      <span style={{ fontWeight: 700, color: 'var(--academic-text-secondary)' }}>{pct}%</span>
                    </div>
                    <div className="ac-progress">
                      <motion.div
                        className={`ac-progress__fill${pct > 85 ? ' ac-progress__fill--warning' : ''}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}

                {!enrolled && !full && (
                  <button
                    type="button"
                    onClick={() => onEnroll?.(t.id)}
                    disabled={loading}
                    className="ac-btn ac-btn-primary ac-focus-ring"
                    style={{ width: '100%' }}
                  >
                    Join Training
                  </button>
                )}
                {enrolled && (
                  <button type="button" disabled className="ac-btn" style={{ width: '100%', opacity: 0.7 }}>
                    <CheckCircle size={14} /> Already enrolled
                  </button>
                )}
                {full && !enrolled && (
                  <button type="button" disabled className="ac-btn" style={{ width: '100%', opacity: 0.55 }}>
                    <AlertCircle size={14} /> Training is full
                  </button>
                )}
              </motion.article>
            )
          })}
        </div>
      )}
    </div>
  )
}
