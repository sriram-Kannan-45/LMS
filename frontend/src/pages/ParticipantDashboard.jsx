import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import AIQuizList from '../components/AIQuizList'
import QuizTaking from '../components/QuizTaking'
import { useToast } from '../components/Toast'
import { API_BASE as API } from '../api/api'

// ─── New student components ─────────────────────────────────────────────────
import OverviewSection from '../components/student/overview/OverviewSection'
import AvailableCourses from '../components/student/dashboard/AvailableCourses'
import MyEnrollments from '../components/student/dashboard/MyEnrollments'
import FeedbackSection from '../components/student/dashboard/FeedbackSection'
import MyFeedbacks from '../components/student/dashboard/MyFeedbacks'
import LeaderboardSection from '../components/student/leaderboard/LeaderboardSection'
import AchievementsSection from '../components/student/achievements/AchievementsSection'
import LessonsSection from '../components/student/lessons/LessonsSection'
import ProfileSection from '../components/student/profile/ProfileSection'
import ParticipantCourses from './ParticipantCourses'
import ParticipantCodingList from '../components/coding-assessment/ParticipantCodingList'
import { useContinueLearning } from '../hooks/useContinueLearning'

const fadeVariant = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

/**
 * ParticipantDashboard — thin orchestrator for the student LMS.
 * Holds shared data (trainings, enrollments, feedbacks, quizzes) and routes
 * each tab to its dedicated section component.
 *
 * Backend contracts (unchanged): /api/trainings, /api/participant/*, /api/feedback,
 * /api/survey, /api/ai-quiz/*. All existing flows preserved.
 */
function ParticipantDashboard({ user, onLogout, activeTab, onTabChange }) {
  const { success, error: showError } = useToast()

  const [trainings, setTrainings] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const { track } = useContinueLearning()

  const auth = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token || ''}` }),
    [user]
  )

  const handleResponse = useCallback(async (res) => {
    if (res.status === 401) {
      onLogout?.()
      throw new Error('Session expired. Please log in again.')
    }
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [onLogout])

  // ─── Fetchers ─────────────────────────────────────────────────────────────
  const fetchTrainings = useCallback(async () => {
    try {
      const r = await fetch(`${API}/trainings`, { headers: auth() })
      const d = await handleResponse(r)
      setTrainings(Array.isArray(d) ? d : (d.trainings || []))
    } catch (e) {
      console.error('fetchTrainings error:', e.message)
    }
  }, [auth, handleResponse])

  const fetchEnrollments = useCallback(async () => {
    try {
      const r = await fetch(`${API}/participant/enrollments`, { headers: auth() })
      const d = await handleResponse(r)
      setEnrollments(d.enrollments || [])
    } catch (e) {
      console.error('fetchEnrollments error:', e.message)
    }
  }, [auth, handleResponse])

  const fetchFeedbacks = useCallback(async () => {
    try {
      const r = await fetch(`${API}/participant/feedbacks`, { headers: auth() })
      const d = await handleResponse(r)
      setFeedbacks(d.feedbacks || [])
    } catch (e) {
      console.error('fetchFeedbacks error:', e.message)
    }
  }, [auth, handleResponse])

  const fetchQuizzes = useCallback(async () => {
    try {
      const r = await fetch(`${API}/ai-quiz/participant/quizzes`, { headers: auth() })
      const d = await handleResponse(r)
      setQuizzes(d.quizzes || [])
    } catch (e) {
      console.error('fetchQuizzes error:', e.message)
    }
  }, [auth, handleResponse])

  const fetchAll = useCallback(() => {
    fetchTrainings(); fetchEnrollments(); fetchFeedbacks(); fetchQuizzes()
  }, [fetchTrainings, fetchEnrollments, fetchFeedbacks, fetchQuizzes])

  useEffect(() => {
    if (user && user.token) {
      fetchAll()
    }
  }, [fetchAll, user])

  // Guard clause for missing/unauthorized user session
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

  // ─── Mutations ────────────────────────────────────────────────────────────
  const handleEnroll = async (trainingId) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/participant/enroll`, {
        method: 'POST', headers: auth(), body: JSON.stringify({ trainingId }),
      })
      const d = await handleResponse(r)
      success('Enrolled successfully!')
      const t = trainings.find((x) => x.id === trainingId)
      if (t) track({ type: 'course', id: trainingId, title: t.title, subtitle: t.trainerName })
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
      const d = await handleResponse(r)
      success('Course unenrolled.')
      fetchAll()
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const fetchSurveyQuestions = async (trainingId) => {
    try {
      const r = await fetch(`${API}/survey/${trainingId}`, { headers: auth() })
      const d = await handleResponse(r)
      return d.questions || []
    } catch (e) {
      console.error('fetchSurveyQuestions error:', e.message)
      return []
    }
  }

  const handleSubmitFeedback = async ({ enrollment, fbForm, surveyAnswers }) => {
    setLoading(true)
    try {
      const payload = { trainingId: enrollment.trainingId, ...fbForm, surveyAnswers }
      const r = await fetch(`${API}/feedback`, {
        method: 'POST', headers: auth(), body: JSON.stringify(payload),
      })
      const d = await handleResponse(r)
      success(d.message || 'Feedback submitted successfully!')
      fetchFeedbacks()
    } catch (e) { showError(e.message); throw e }
    finally { setLoading(false) }
  }

  // ─── Quiz state ─────────────────────────────────────────────────────────
  // The secure assessment flow (consent gate → fullscreen → live exam) now
  // lives entirely inside <AIQuizzesDashboard /> — we no longer render
  // <QuizTaking /> from this page. handleStartQuiz remains only as a hook
  // for the continue-learning tracker; the dashboard renders normally.
  const handleStartQuiz = (attemptId, quiz) => {
    if (quiz?.id) track({ type: 'quiz', id: quiz.id, title: quiz.title })
  }
  const handleQuizComplete = (result) => {
    if (result?.percentage != null) success(`Quiz submitted! Score: ${result.percentage.toFixed(1)}%`)
    fetchQuizzes()
  }

  // ─── Continue-learning click handler ──────────────────────────────────────
  const handleResume = (item) => {
    if (item.type === 'course') handleTabChange('available')
    else if (item.type === 'quiz') handleTabChange('ai-quizzes')
    else if (item.type === 'lesson') handleTabChange('lessons')
  }

  return (
    <div className="dashboard" style={{ padding: 0 }}>
      {tab === 'overview' && (
        <motion.div key="overview" {...fadeVariant} transition={{ duration: 0.25 }}>
          <OverviewSection
            user={user}
            trainings={trainings}
            enrollments={enrollments}
            quizzes={quizzes}
            onGoToCourses={() => handleTabChange('available')}
            onResume={handleResume}
            onClickCourse={() => handleTabChange('myEnrollments')}
            onClickQuiz={() => handleTabChange('ai-quizzes')}
          />
        </motion.div>
      )}

      {tab === 'available' && (
        <motion.div key="available" {...fadeVariant} transition={{ duration: 0.25 }}>
          <AvailableCourses
            trainings={trainings}
            enrollments={enrollments}
            loading={loading}
            onEnroll={handleEnroll}
          />
        </motion.div>
      )}

      {tab === 'myEnrollments' && (
        <motion.div key="myEnrollments" {...fadeVariant} transition={{ duration: 0.25 }}>
          <ParticipantCourses user={user} />
        </motion.div>
      )}

      {tab === 'lessons' && (
        <motion.div key="lessons" {...fadeVariant} transition={{ duration: 0.25 }}>
          <LessonsSection />
        </motion.div>
      )}

      {tab === 'ai-quizzes' && (
        <motion.div key="ai-quizzes" {...fadeVariant} transition={{ duration: 0.25 }}>
          <AIQuizList user={user} onStartQuiz={handleStartQuiz} />
        </motion.div>
      )}

      {tab === 'coding' && (
        <motion.div key="coding" {...fadeVariant} transition={{ duration: 0.25 }}>
          <ParticipantCodingList />
        </motion.div>
      )}

      {tab === 'leaderboard' && (
        <motion.div key="leaderboard" {...fadeVariant} transition={{ duration: 0.25 }}>
          <LeaderboardSection
            enrollments={enrollments}
            quizzes={quizzes}
            currentUserId={user?.id}
          />
        </motion.div>
      )}

      {tab === 'achievements' && (
        <motion.div key="achievements" {...fadeVariant} transition={{ duration: 0.25 }}>
          <AchievementsSection user={user} enrollmentsCount={enrollments.length} />
        </motion.div>
      )}

      {tab === 'feedback' && (
        <motion.div key="feedback" {...fadeVariant} transition={{ duration: 0.25 }}>
          <FeedbackSection
            enrollments={enrollments}
            feedbacks={feedbacks}
            loading={loading}
            onSubmit={handleSubmitFeedback}
            fetchQuestions={fetchSurveyQuestions}
          />
        </motion.div>
      )}

      {tab === 'myFeedbacks' && (
        <motion.div key="myFeedbacks" {...fadeVariant} transition={{ duration: 0.25 }}>
          <MyFeedbacks feedbacks={feedbacks} loading={loading} />
        </motion.div>
      )}

      {tab === 'profile' && (
        <motion.div key="profile" {...fadeVariant} transition={{ duration: 0.25 }}>
          <ProfileSection
            user={user}
            enrollments={enrollments}
            quizzes={quizzes}
            onResume={handleResume}
            onTabChange={handleTabChange}
          />
        </motion.div>
      )}
    </div>
  )
}

export default ParticipantDashboard
