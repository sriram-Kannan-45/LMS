import WelcomeBanner from './WelcomeBanner'
import StatGrid from './StatGrid'
import AccuracyTrendChart from './AccuracyTrendChart'
import ContinueLearning from './ContinueLearning'
import UpcomingSchedule from './UpcomingSchedule'
import DailyActivity from './DailyActivity'
import { useStudentStats } from '../../../hooks/useStudentStats'
import { useContinueLearning } from '../../../hooks/useContinueLearning'

/**
 * OverviewSection — student's home/landing tab.
 * Composes all overview widgets. Receives shared dashboard data via props
 * to avoid double-fetching.
 */
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
  const { stats, loading: statsLoading } = useStudentStats()
  const { items: recentItems } = useContinueLearning()

  // Derive a "streak" client-side: count consecutive days backwards from today
  // that have at least one quiz attempt.
  const trend = stats?.accuracyTrend || []
  const dates = new Set(trend.map((t) => t.date))
  let streak = 0
  for (let i = 0; i < 90; i++) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (dates.has(key)) streak++
    else if (i > 0) break  // streak broken
  }

  return (
    <div className="ov-shell">
      <WelcomeBanner
        user={user}
        streak={streak}
        enrollmentsCount={enrollments.length}
        onPrimaryAction={onGoToCourses}
        primaryActionLabel="Browse courses"
      />

      <StatGrid stats={stats} loading={statsLoading} />

      {/* Two-column row: Continue Learning + Upcoming */}
      <div className="ac-grid-2">
        <ContinueLearning items={recentItems} onResume={onResume} />
        <UpcomingSchedule
          enrollments={enrollments}
          quizzes={quizzes}
          onClickQuiz={onClickQuiz}
          onClickCourse={onClickCourse}
        />
      </div>

      {/* Two-column row: Daily Activity + Accuracy Trend */}
      <div className="ac-grid-2">
        <DailyActivity userId={user?.id} />
        <AccuracyTrendChart data={trend} loading={statsLoading} />
      </div>
    </div>
  )
}
