import { motion } from 'framer-motion'
import { Award, Trophy } from 'lucide-react'
import BadgeGrid from './BadgeGrid'
import CertificateCard from './CertificateCard'
import { useStudentStats } from '../../../hooks/useStudentStats'

/**
 * AchievementsSection — Badges + Certificates tab.
 * Both are derived client-side from the student stats endpoint.
 * No backend changes required.
 */
export default function AchievementsSection({ user, enrollmentsCount = 0 }) {
  const { stats, loading } = useStudentStats()

  // Streak — same logic as OverviewSection
  const dates = new Set((stats?.accuracyTrend || []).map((t) => t.date))
  let streak = 0
  for (let i = 0; i < 90; i++) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (dates.has(key)) streak++
    else if (i > 0) break
  }

  const certificates = (stats?.breakdownByQuiz || [])
    .filter((q) => (q.bestScore ?? 0) >= 70)
    .sort((a, b) => b.bestScore - a.bestScore)

  return (
    <div className="ac-stack">
      <div className="flex items-center gap-3">
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'var(--academic-gradient-accent)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 18px rgba(20,184,166,0.28)',
        }}>
          <Trophy size={20} />
        </div>
        <div>
          <h2 className="ac-section-title">Achievements</h2>
          <p className="ac-section-subtitle">Badges and certificates you've earned</p>
        </div>
      </div>

      {/* BADGES */}
      {loading ? (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="ac-card" style={{ padding: 20, textAlign: 'center' }}>
              <div className="ac-skeleton" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 12px' }} />
              <div className="ac-skeleton" style={{ width: '60%', height: 14, margin: '0 auto 6px' }} />
              <div className="ac-skeleton" style={{ width: '80%', height: 10, margin: '0 auto' }} />
            </div>
          ))}
        </div>
      ) : (
        <BadgeGrid stats={stats} enrollmentsCount={enrollmentsCount} streak={streak} />
      )}

      {/* CERTIFICATES */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 className="ac-section-title" style={{ fontSize: 18 }}>Certificates</h3>
            <p className="ac-section-subtitle">{certificates.length} earned • Score 70%+ to qualify</p>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 10,
            background: 'var(--academic-secondary-50)',
            color: 'var(--academic-secondary-600)',
            fontSize: 12, fontWeight: 700,
            border: '1px solid var(--academic-secondary-100)',
          }}>
            <Award size={13} /> Auto-generated
          </div>
        </div>

        {!loading && certificates.length === 0 && (
          <div className="ac-empty">
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
              background: 'var(--academic-secondary-50)', color: 'var(--academic-secondary-600)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Award size={28} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No certificates yet</h3>
            <p style={{ fontSize: 14, color: 'var(--academic-text-muted)' }}>
              Score <strong>70% or higher</strong> on any quiz to unlock a printable certificate.
            </p>
          </div>
        )}

        {certificates.length > 0 && (
          <div className="grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {certificates.map((cert, i) => (
              <CertificateCard
                key={cert.quizId}
                certificate={cert}
                studentName={user?.name || 'Student'}
                index={i}
              />
            ))}
          </div>
        )}
      </motion.section>
    </div>
  )
}
