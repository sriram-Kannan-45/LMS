import { motion } from 'framer-motion'
import { MessageSquare, Star, Reply } from 'lucide-react'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function StaticStars({ value = 0 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          fill={s <= value ? '#f59e0b' : 'transparent'}
          stroke={s <= value ? '#f59e0b' : 'var(--academic-border-strong)'}
          strokeWidth={1.6}
        />
      ))}
    </span>
  )
}

export default function MyFeedbacks({ feedbacks = [], loading = false }) {
  return (
    <div className="ac-stack">
      <div>
        <h2 className="ac-section-title">My Feedback History</h2>
        <p className="ac-section-subtitle">{feedbacks.length} feedback{feedbacks.length === 1 ? '' : 's'} submitted</p>
      </div>

      {!loading && feedbacks.length === 0 && (
        <div className="ac-empty">
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'var(--academic-info-50)', color: 'var(--academic-info)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No feedback yet</h3>
          <p style={{ fontSize: 14, color: 'var(--academic-text-muted)' }}>
            Once you submit a course review, it'll appear here.
          </p>
        </div>
      )}

      {feedbacks.length > 0 && (
        <div className="ac-stack-sm">
          {feedbacks.map((f, i) => (
            <motion.article
              key={f.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.24) }}
              className="ac-card"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 700,
                    color: 'var(--academic-text)', marginBottom: 4,
                  }}>
                    {f.trainingTitle}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--academic-text-muted)' }}>
                    Submitted {fmtDate(f.submittedAt)}
                  </p>
                </div>
                {f.anonymous && <span className="ac-chip">Anonymous</span>}
              </div>

              <div className="ac-grid-2" style={{ marginBottom: 12 }}>
                <div className="flex items-center gap-2" style={{
                  padding: '10px 14px', borderRadius: 10, background: 'var(--academic-bg-soft)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--academic-text-muted)' }}>Instructor</span>
                  <StaticStars value={f.trainerRating} />
                  <span style={{ fontSize: 12, color: 'var(--academic-text-secondary)', marginLeft: 'auto' }}>{f.trainerRating}/5</span>
                </div>
                <div className="flex items-center gap-2" style={{
                  padding: '10px 14px', borderRadius: 10, background: 'var(--academic-bg-soft)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--academic-text-muted)' }}>Subject</span>
                  <StaticStars value={f.subjectRating} />
                  <span style={{ fontSize: 12, color: 'var(--academic-text-secondary)', marginLeft: 'auto' }}>{f.subjectRating}/5</span>
                </div>
              </div>

              {f.comments && (
                <p style={{
                  fontSize: 13.5, lineHeight: 1.55, color: 'var(--academic-text-secondary)',
                  padding: 12, borderRadius: 10, background: 'var(--academic-surface-soft)',
                  borderLeft: '3px solid var(--academic-primary-200)',
                }}>
                  "{f.comments}"
                </p>
              )}

              {f.trainerResponse && (
                <div style={{
                  marginTop: 10, padding: 12, borderRadius: 10,
                  background: 'var(--academic-secondary-50)',
                  borderLeft: '3px solid var(--academic-secondary-500)',
                }}>
                  <div className="flex items-center gap-2 mb-1.5" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--academic-secondary-600)' }}>
                    <Reply size={12} /> INSTRUCTOR REPLIED
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--academic-text)', lineHeight: 1.5 }}>{f.trainerResponse}</p>
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}
    </div>
  )
}
