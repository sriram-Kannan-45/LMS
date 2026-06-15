import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import AIQuizList from '../components/AIQuizList'
import { useToast } from '../components/Toast'
import { API_BASE as API, requestAll, getAuthHeaders } from '../api'
import SkeletonCard from '../components/SkeletonCard'
import { SkeletonStats } from '../components/Skeleton'

// Lazy-load large section components
const OverviewSection = React.lazy(() => import('../components/student/overview/OverviewSection'))
const AvailableCourses = React.lazy(() => import('../components/student/dashboard/AvailableCourses'))
const MyEnrollments = React.lazy(() => import('../components/student/dashboard/MyEnrollments'))
const FeedbackSection = React.lazy(() => import('../components/student/dashboard/FeedbackSection'))
const MyFeedbacks = React.lazy(() => import('../components/student/dashboard/MyFeedbacks'))
const LeaderboardSection = React.lazy(() => import('../components/student/leaderboard/LeaderboardSection'))
const AchievementsSection = React.lazy(() => import('../components/student/achievements/AchievementsSection'))
const LessonsSection = React.lazy(() => import('../components/student/lessons/LessonsSection'))
const ProfileSection = React.lazy(() => import('../components/student/profile/ProfileSection'))
const ParticipantCodingList = React.lazy(() => import('../components/coding-assessment/ParticipantCodingList'))

const fadeVariant = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

const SectionLoader = () => (
  <div className="space-y-4 p-4">
    <SkeletonStats />
    <SkeletonCard variant="training" count={2} />
  </div>
)

function ParticipantDashboard({ user, onLogout, activeTab, onTabChange }) {
  const { success, error: showError } = useToast()

  const [trainings, setTrainings] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const mountedRef = useRef(true)

  const auth = useCallback(
    () => getAuthHeaders(user),
    [user]
  )

  // ─── Parallel data fetching ────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const headers = auth()
    if (!headers.Authorization) return

    try {
      const results = await requestAll([
        { url: `${API}/trainings`, options: { headers } },
        { url: `${API}/participant/enrollments`, options: { headers } },
        { url: `${API}/participant/feedbacks`, options: { headers } },
        { url: `${API}/ai-quiz/participant/quizzes`, options: { headers } },
      ])

      if (!mountedRef.current) return

      results.forEach(r => {
        if (r.status === 'fulfilled' && r.data) {
          switch (true) {
            case r.url.includes('/trainings'):
              setTrainings(Array.isArray(r.data) ? r.data : (r.data.trainings || []))
              break
            case r.url.includes('/enrollments'):
              setEnrollments(r.data.enrollments || [])
              break
            case r.url.includes('/feedbacks'):
              setFeedbacks(r.data.feedbacks || [])
              break
            case r.url.includes('/quizzes'):
              setQuizzes(r.data.quizzes || [])
              break
          }
        }
      })
    } catch (e) {
      if (mountedRef.current) showError('Failed to load dashboard data')
    } finally {
      if (mountedRef.current) setInitialLoading(false)
    }
  }, [auth, showError])

  useEffect(() => {
    mountedRef.current = true
    if (user && user.token) {
      fetchAll()
    } else {
      setInitialLoading(false)
    }
    return () => { mountedRef.current = false }
  }, [fetchAll, user])

  if (!user || !user.token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: "'Manrope', 'Inter', sans-serif"
      }}>
        <Loader2 style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} size={36} />
        <span style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>Verifying session...</span>
      </div>
    )
  }

  const tab = activeTab || 'overview'
  const handleTabChange = (next) => onTabChange?.(next)

  // ─── Mutations with cache invalidation ────────────────────────────────
  const handleEnroll = async (trainingId) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/participant/enroll`, {
        method: 'POST', headers: auth(), body: JSON.stringify({ trainingId }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Enrollment failed')
      success('Enrolled successfully!')
      fetchAll()
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleCancelEnrollment = async (trainingId) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/participant/enroll/${trainingId}`, {
        method: 'DELETE', headers: auth(),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Unenrollment failed')
      success('Course unenrolled.')
      fetchAll()
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const fetchSurveyQuestions = async (trainingId) => {
    try {
      const r = await fetch(`${API}/survey/${trainingId}`, { headers: auth() })
      const d = await r.json()
      return d.questions || []
    } catch {
      return []
    }
  }

  const handleSubmitFeedback = async ({ enrollment, fbForm, surveyAnswers }) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/feedback`, {
        method: 'POST', headers: auth(), body: JSON.stringify({
          trainingId: enrollment.trainingId, ...fbForm, surveyAnswers,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Feedback failed')
      success(d.message || 'Feedback submitted successfully!')
      fetchAll()
    } catch (e) { showError(e.message); throw e }
    finally { setLoading(false) }
  }

  const handleStartQuiz = (attemptId, quiz) => {}

  if (initialLoading) return <SectionLoader />

  return (
    <div className="dashboard" style={{ padding: 0 }}>
      {tab === 'overview' && (
        <motion.div key="overview" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <OverviewSection
              user={user}
              trainings={trainings}
              enrollments={enrollments}
              quizzes={quizzes}
              onGoToCourses={() => handleTabChange('available')}
              onClickCourse={() => handleTabChange('myEnrollments')}
              onClickQuiz={() => handleTabChange('ai-quizzes')}
            />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'available' && (
        <motion.div key="available" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <AvailableCourses
              trainings={trainings}
              enrollments={enrollments}
              loading={loading}
              onEnroll={handleEnroll}
            />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'myEnrollments' && (
        <motion.div key="myEnrollments" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <ParticipantCourses user={user} />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'lessons' && (
        <motion.div key="lessons" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <LessonsSection />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'ai-quizzes' && (
        <motion.div key="ai-quizzes" {...fadeVariant} transition={{ duration: 0.25 }}>
          <AIQuizList user={user} onStartQuiz={handleStartQuiz} />
        </motion.div>
      )}

      {tab === 'coding' && (
        <motion.div key="coding" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <ParticipantCodingList />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'leaderboard' && (
        <motion.div key="leaderboard" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <LeaderboardSection
              enrollments={enrollments}
              quizzes={quizzes}
              currentUserId={user?.id}
            />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'achievements' && (
        <motion.div key="achievements" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <AchievementsSection user={user} enrollmentsCount={enrollments.length} />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'feedback' && (
        <motion.div key="feedback" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <FeedbackSection
              enrollments={enrollments}
              feedbacks={feedbacks}
              loading={loading}
              onSubmit={handleSubmitFeedback}
              fetchQuestions={fetchSurveyQuestions}
            />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'myFeedbacks' && (
        <motion.div key="myFeedbacks" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <MyFeedbacks feedbacks={feedbacks} loading={loading} />
          </React.Suspense>
        </motion.div>
      )}

      {tab === 'profile' && (
        <motion.div key="profile" {...fadeVariant} transition={{ duration: 0.25 }}>
          <React.Suspense fallback={<SectionLoader />}>
            <ProfileSection
              user={user}
              enrollments={enrollments}
              quizzes={quizzes}
              onTabChange={handleTabChange}
            />
          </React.Suspense>
        </motion.div>
      )}
    </div>
  )
}

export default ParticipantDashboard
