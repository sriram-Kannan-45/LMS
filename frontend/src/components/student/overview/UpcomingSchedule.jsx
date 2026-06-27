import { motion } from 'framer-motion'
import { Calendar, Clock, BookOpen, Sparkles } from 'lucide-react'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

const daysFromNow = (d) => {
  if (!d) return null
  const ms = new Date(d).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

/**
 * UpcomingSchedule — combines two sources:
 *  1. Trainings the student is enrolled in that have a future startDate
 *  2. Published quizzes that the student hasn't taken yet
 *
 * Pure derivation — no extra API calls.
 */
export default function UpcomingSchedule({ enrollments = [], quizzes = [], onClickQuiz, onClickCourse }) {
  // Future-dated enrollments
  const upcomingCourses = enrollments
    .filter((e) => e.startDate && new Date(e.startDate) > new Date())
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(0, 3)

  // Quizzes not yet attempted (no completionPercent or 0)
  const pendingQuizzes = quizzes
    .filter((q) => (q.completionPercent ?? 0) === 0)
    .slice(0, 3)

  const items = [
    ...upcomingCourses.map((e) => ({
      kind: 'course',
      id: e.id,
      title: e.trainingTitle,
      meta: e.trainerName ? `with ${e.trainerName}` : '',
      date: e.startDate,
      onClick: () => onClickCourse?.(e),
    })),
    ...pendingQuizzes.map((q) => ({
      kind: 'quiz',
      id: q.id,
      title: q.title,
      meta: `${q.questionCount ?? q.questions?.length ?? 0} questions · ${q.timeLimit || 30} min`,
      date: null,
      onClick: () => onClickQuiz?.(q),
    })),
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="ac-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="ac-section-title" style={{ fontSize: 17 }}>Coming up</h3>
          <p className="ac-section-subtitle">Quizzes & upcoming courses</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="ac-empty" style={{ padding: '32px 20px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
            background: 'var(--academic-secondary-50)', color: 'var(--academic-secondary-600)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Calendar size={20} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--academic-text-muted)' }}>
            Nothing scheduled. You're all caught up!
          </p>
        </div>
      ) : (
        <div className="ac-stack-sm">
          {items.map((item, i) => {
            const Icon = item.kind === 'quiz' ? Sparkles : BookOpen
            const tone = item.kind === 'quiz'
              ? { bg: 'var(--academic-accent-50)', color: 'var(--academic-accent-500)' }
              : { bg: 'var(--academic-primary-50)', color: 'var(--academic-primary-700)' }
            const days = daysFromNow(item.date)
            return (
              <motion.button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={item.onClick}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.2) }}
                whileHover={{ y: -2 }}
                className="ac-focus-ring"
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px',
                  border: '1px solid var(--academic-border-soft)',
                  borderRadius: 12, background: 'var(--academic-surface)',
                  cursor: 'pointer', textAlign: 'left',
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
                  <div style={{
                    fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 700,
                    color: 'var(--academic-text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {item.title}
                  </div>
                  {item.meta && (
                    <div style={{ fontSize: 12, color: 'var(--academic-text-muted)' }}>
                      {item.meta}
                    </div>
                  )}
                </div>
                {item.date ? (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--academic-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {fmtDate(item.date)}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--academic-text-muted)' }}>
                      {days != null && days > 0 ? `in ${days}d` : days === 0 ? 'today' : ''}
                    </div>
                  </div>
                ) : (
                  <span className="ac-chip ac-chip-violet" style={{ flexShrink: 0 }}>
                    <Clock size={10} /> Pending
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      )}
    </motion.section>
  )
}
