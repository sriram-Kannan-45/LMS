import { motion } from 'framer-motion'
import { BookOpen, TrendingUp, Award, Clock, ArrowRight, Sparkles, BarChart3, ChevronRight } from 'lucide-react'
import { useStudentStats } from '../../../hooks/useStudentStats'
import { useContinueLearning } from '../../../hooks/useContinueLearning'

export default function OverviewSection({
  user,
  trainings = [],
  enrollments = [],
  quizzes = [],
  onGoToCourses,
  onResume,
  onClickCourse,
  onClickQuiz,
}) {
  const { stats, loading } = useStudentStats()

  const enrolledCount = enrollments.length
  const completedCount = enrollments.filter(e => e.status === 'COMPLETED').length
  const quizCount = quizzes.length
  const avgScore = stats?.averageScore ?? 0

  const { continueLearning } = useContinueLearning()
  const recentItems = (continueLearning || []).slice(0, 3)

  return (
    <div style={{ padding: '4px 0' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>
            Welcome back, {user?.name?.split(' ')[0] || 'Student'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 2 }}>
            Here's your learning overview
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary"
          onClick={onGoToCourses}
        >
          <BookOpen size={16} />
          Browse Courses
        </motion.button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <span className="stat-label">Enrolled Courses</span>
          <span className="stat-value">{enrolledCount}</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} style={{ color: '#10b981' }} />
            </div>
          </div>
          <span className="stat-label">Completed</span>
          <span className="stat-value">{completedCount}</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={18} style={{ color: '#f59e0b' }} />
            </div>
          </div>
          <span className="stat-label">Avg Score</span>
          <span className="stat-value">{avgScore > 0 ? `${avgScore}%` : '—'}</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(20,184,166,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} style={{ color: '#14B8A6' }} />
            </div>
          </div>
          <span className="stat-label">Quizzes</span>
          <span className="stat-value">{quizCount}</span>
        </div>
      </div>

      {recentItems.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h3><Clock size={16} style={{ marginRight: 8, display: 'inline' }} />Continue Learning</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentItems.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onResume?.(item)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                  background: 'var(--bg-hover)', transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {item.type === 'course' ? 'Course' : item.type === 'quiz' ? 'Quiz' : 'Lesson'} &middot; {item.subtitle || ''}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card" style={{ cursor: 'pointer' }} onClick={onClickCourse}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>My Courses</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{enrolledCount} enrolled</div>
            </div>
            <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div className="card" style={{ cursor: 'pointer' }} onClick={onClickQuiz}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(20,184,166,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} style={{ color: '#14B8A6' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>AI Quizzes</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{quizCount} available</div>
            </div>
            <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
