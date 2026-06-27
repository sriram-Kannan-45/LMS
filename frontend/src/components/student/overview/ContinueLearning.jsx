import { motion } from 'framer-motion'
import { ArrowRight, Play, BookOpen, FileText, Sparkles } from 'lucide-react'

const TYPE_ICON = { course: BookOpen, lesson: FileText, quiz: Sparkles }
const TYPE_LABEL = { course: 'Course', lesson: 'Lesson', quiz: 'Quiz' }
const TYPE_TONE = {
  course: { bg: 'var(--academic-primary-50)', color: 'var(--academic-primary-700)' },
  lesson: { bg: 'var(--academic-secondary-50)', color: 'var(--academic-secondary-600)' },
  quiz:   { bg: 'var(--academic-accent-50)',    color: 'var(--academic-accent-500)' },
}

const fmtAgo = (ts) => {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/**
 * ContinueLearning — last-touched courses/lessons/quizzes (localStorage).
 */
export default function ContinueLearning({ items = [], onResume }) {
  if (items.length === 0) {
    return (
      <section className="ac-card">
        <h3 className="ac-section-title" style={{ fontSize: 17 }}>Pick up where you left off</h3>
        <p className="ac-section-subtitle" style={{ marginBottom: 16 }}>Your recent activity will appear here</p>
        <div className="ac-empty" style={{ padding: '32px 20px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
            background: 'var(--academic-primary-50)', color: 'var(--academic-primary)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Play size={20} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--academic-text-muted)' }}>
            Start a course, take a quiz, or open a lesson to see it here.
          </p>
        </div>
      </section>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="ac-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="ac-section-title" style={{ fontSize: 17 }}>Continue learning</h3>
          <p className="ac-section-subtitle">{items.length} recent</p>
        </div>
      </div>

      <div className="ac-stack-sm">
        {items.map((item, i) => {
          const Icon = TYPE_ICON[item.type] || BookOpen
          const tone = TYPE_TONE[item.type] || TYPE_TONE.course
          return (
            <motion.button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => onResume?.(item)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.2) }}
              whileHover={{ x: 2, backgroundColor: 'var(--academic-surface-soft)' }}
              className="ac-focus-ring"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                border: '1px solid var(--academic-border-soft)',
                borderRadius: 12,
                background: 'var(--academic-surface)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 200ms ease',
              }}
            >
              <span style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: tone.bg, color: tone.color,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                    textTransform: 'uppercase', color: tone.color,
                  }}>
                    {TYPE_LABEL[item.type] || 'Item'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--academic-text-muted)' }}>
                    · {fmtAgo(item.ts)}
                  </span>
                </div>
                <div style={{
                  fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 700,
                  color: 'var(--academic-text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {item.title}
                </div>
                {item.subtitle && (
                  <div style={{
                    fontSize: 12, color: 'var(--academic-text-muted)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.subtitle}
                  </div>
                )}
                {typeof item.progress === 'number' && (
                  <div className="ac-progress" style={{ height: 5, marginTop: 6 }}>
                    <div
                      className="ac-progress__fill"
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                )}
              </div>
              <ArrowRight size={16} style={{ color: 'var(--academic-text-muted)', flexShrink: 0 }} />
            </motion.button>
          )
        })}
      </div>
    </motion.section>
  )
}
