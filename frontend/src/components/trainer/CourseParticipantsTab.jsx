import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, User, Calendar, BookOpen, Sparkles, ClipboardList, Eye } from 'lucide-react'
import { API } from '../../api/api'
import { useToast } from '../Toast'

function ProgressBar({ percent, color = '#4f46e5' }) {
  const v = Math.max(0, Math.min(100, Number(percent || 0)))
  return (
    <div style={{
      height: 6, width: '100%', minWidth: 80, background: '#f1f5f9',
      borderRadius: 999, overflow: 'hidden',
    }}>
      <div style={{ width: `${v}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
    </div>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function initials(name) {
  if (!name) return '?'
  return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ════════════════════════════════════════════════════════════════════════════
// Detail modal
// ════════════════════════════════════════════════════════════════════════════
function ParticipantDetailModal({ user, courseId, participantId, onClose }) {
  const { error: showError } = useToast()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('progress')

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch(API.TRAINER_COURSES.PARTICIPANT(courseId, participantId), {
          headers: { Authorization: `Bearer ${user.token}` },
        })
        const d = await r.json()
        if (aborted) return
        if (d.success) setData(d)
        else showError(d.error || 'Failed to load participant detail')
      } catch (e) { showError(e.message) }
    })()
    return () => { aborted = true }
  }, [participantId])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 60px -10px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: 18, borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 999,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            }}>
              {initials(data?.participant?.name)}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                {data?.participant?.name || 'Loading…'}
              </div>
              {data?.participant?.email && (
                <div style={{ fontSize: 12, color: '#64748b' }}>{data.participant.email}</div>
              )}
              {data?.enrollment && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Enrolled {fmtDate(data.enrollment.enrolledAt)} · Progress {Math.round(data.enrollment.progressPercent)}%
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: '#f1f5f9', color: '#475569',
            padding: 8, borderRadius: 8, cursor: 'pointer',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: 12, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 4 }}>
          {[
            { key: 'progress',    label: 'Progress',     icon: <BookOpen size={14} /> },
            { key: 'quizzes',     label: 'Quiz Results', icon: <Sparkles size={14} /> },
            { key: 'assessments', label: 'Assessments',  icon: <ClipboardList size={14} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 12px', border: 'none', cursor: 'pointer',
                borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: tab === t.key ? '#4f46e5' : 'transparent',
                color: tab === t.key ? '#fff' : '#475569',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          {!data ? (
            <div style={{ height: 200, background: '#f1f5f9', borderRadius: 10 }} />
          ) : tab === 'progress' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data.lessons || []).map((l) => (
                <div key={l.lessonId} style={rowCard()}>
                  <div style={{ flex: 1, fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                    {l.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 8, flexShrink: 0 }}>
                    <span>{l.contentViewed ? '✓ Viewed' : '○ Not viewed'}</span>
                    <span>·</span>
                    <span style={{ color: l.status === 'COMPLETED' ? '#15803d' : l.status === 'IN_PROGRESS' ? '#92400e' : '#94a3b8', fontWeight: 600 }}>
                      {l.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {(!data.lessons || data.lessons.length === 0) && (
                <div style={emptyCard}>No lessons in this course yet.</div>
              )}
            </div>
          ) : tab === 'quizzes' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data.quizzes || []).map(q => (
                <div key={q.quizId} style={rowCard()}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{q.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {q.submitted ? 'Submitted' : 'Not submitted yet'}
                      {q.resultPublished && q.score != null && ' · Result published'}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: q.score != null && q.resultPublished ? '#15803d' : '#94a3b8' }}>
                    {q.score != null && q.resultPublished ? `${q.score.toFixed(0)}%` : '—'}
                  </div>
                </div>
              ))}
              {(!data.quizzes || data.quizzes.length === 0) && (
                <div style={emptyCard}>No quizzes for this course.</div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data.assessments || []).map(a => (
                <div key={a.submissionId} style={{ ...rowCard(), display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                      {a.title || `Assessment #${a.assessmentId}`}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: a.status === 'PUBLISHED' ? '#dcfce7' : a.status === 'REVIEWED' ? '#fef3c7' : '#dbeafe',
                      color:      a.status === 'PUBLISHED' ? '#15803d' : a.status === 'REVIEWED' ? '#92400e' : '#1d4ed8',
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>
                      {a.status}
                    </span>
                  </div>
                  {a.score != null && (
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
                      Score: <strong>{a.score}</strong>
                    </div>
                  )}
                  {a.feedback && (
                    <div style={{
                      fontSize: 12, color: '#64748b', marginTop: 6,
                      padding: 8, background: '#f8fafc', borderRadius: 6,
                    }}>
                      {a.feedback}
                    </div>
                  )}
                </div>
              ))}
              {(!data.assessments || data.assessments.length === 0) && (
                <div style={emptyCard}>No assessments submitted.</div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Main tab
// ════════════════════════════════════════════════════════════════════════════
export default function CourseParticipantsTab({ user, courseId }) {
  const { error: showError } = useToast()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('progress')
  const [openDetailId, setOpenDetailId] = useState(null)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        setLoading(true)
        const r = await fetch(API.TRAINER_COURSES.PARTICIPANTS(courseId), {
          headers: { Authorization: `Bearer ${user.token}` },
        })
        const d = await r.json()
        if (aborted) return
        if (d.success) setParticipants(d.participants || [])
        else showError(d.error || 'Failed to load participants')
      } catch (e) { showError(e.message) }
      finally { if (!aborted) setLoading(false) }
    })()
    return () => { aborted = true }
  }, [courseId])

  const filtered = useMemo(() => {
    let out = participants
    if (search) {
      const q = search.toLowerCase()
      out = out.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      )
    }
    out = [...out].sort((a, b) => {
      if (sortBy === 'name')     return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'progress') return (b.progressPercent || 0) - (a.progressPercent || 0)
      if (sortBy === 'score')    return (b.avgQuizScore || 0) - (a.avgQuizScore || 0)
      return 0
    })
    return out
  }, [participants, search, sortBy])

  const stats = useMemo(() => {
    const n = participants.length
    if (n === 0) return { total: 0, avgCompletion: 0, avgScore: null }
    const avgCompletion = participants.reduce((s, p) => s + Number(p.progressPercent || 0), 0) / n
    const scoresOnly = participants.map(p => Number(p.avgQuizScore || 0)).filter(x => x > 0)
    const avgScore = scoresOnly.length ? scoresOnly.reduce((s, x) => s + x, 0) / scoresOnly.length : null
    return { total: n, avgCompletion, avgScore }
  }, [participants])

  return (
    <div>
      {/* Stat cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12, marginBottom: 20,
      }}>
        <StatCard label="Total Enrolled"    value={stats.total} bg="#eef2ff" fg="#4f46e5" />
        <StatCard label="Avg Completion"    value={`${stats.avgCompletion.toFixed(1)}%`} bg="#dcfce7" fg="#15803d" />
        <StatCard label="Avg Quiz Score"    value={stats.avgScore != null ? `${stats.avgScore.toFixed(1)}%` : '—'} bg="#fef3c7" fg="#92400e" />
      </div>

      {/* Search + sort */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          flex: '1 1 280px', display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          padding: '10px 14px',
        }}>
          <Search size={14} color="#94a3b8" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13 }}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '10px 14px', fontSize: 13, color: '#475569',
          }}
        >
          <option value="progress">Sort: Progress (high→low)</option>
          <option value="score">Sort: Quiz Score (high→low)</option>
          <option value="name">Sort: Name (A→Z)</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ height: 240, background: '#f1f5f9', borderRadius: 10 }} />
      ) : filtered.length === 0 ? (
        <div style={emptyCard}>
          {participants.length === 0
            ? 'No participants enrolled yet.'
            : 'No participants match your search.'}
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={th}>Participant</th>
                <th style={th}>Enrolled</th>
                <th style={th}>Lessons</th>
                <th style={th}>Avg Quiz</th>
                <th style={th}>Progress</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <motion.tr
                  key={p.participantId}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ borderTop: '1px solid #f1f5f9' }}
                >
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 999, flexShrink: 0,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {initials(p.name)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: '#64748b' }}>{fmtDate(p.enrolledAt)}</td>
                  <td style={{ ...td, fontSize: 13, color: '#475569' }}>
                    {p.lessonsDone} / {p.totalLessons}
                  </td>
                  <td style={{ ...td, fontSize: 13, fontWeight: 600, color: p.avgQuizScore ? '#15803d' : '#94a3b8' }}>
                    {p.avgQuizScore != null ? `${Number(p.avgQuizScore).toFixed(0)}%` : '—'}
                  </td>
                  <td style={{ ...td, minWidth: 140 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <ProgressBar percent={p.progressPercent} />
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>
                        {Math.round(p.progressPercent)}%
                      </span>
                    </div>
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => setOpenDetailId(p.participantId)}
                      title="View detail"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '6px 10px', background: '#eef2ff', color: '#4f46e5',
                        border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Eye size={12} /> View
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {openDetailId && (
          <ParticipantDetailModal
            user={user}
            courseId={courseId}
            participantId={openDetailId}
            onClose={() => setOpenDetailId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, bg, fg }) {
  return (
    <div style={{
      padding: '16px 20px', background: bg, color: fg, borderRadius: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>
        {value}
      </div>
    </div>
  )
}

const th = { padding: 12, textAlign: 'left', fontSize: 11, fontWeight: 700,
              color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }
const td = { padding: 12, verticalAlign: 'middle' }
const rowCard = () => ({
  display: 'flex', gap: 12, alignItems: 'center', padding: 12,
  border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff',
})
const emptyCard = {
  padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13,
  background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12,
}
