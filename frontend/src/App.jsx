import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom'
import AssessmentLobby from './components/coding-assessment/AssessmentLobby'
import CodingAssessmentForm from './components/coding-assessment/CodingAssessmentForm'
import CodingAssessmentResults from './components/coding-assessment/CodingAssessmentResults'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import NotificationsPanel from './components/student/shell/NotificationsPanel'
import { ToastProvider } from './components/Toast'
import { AppThemeProvider } from './context/AppThemeContext'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import AdminRecordings from './pages/AdminRecordings'
import ExamPage from './pages/ExamPage'
import ExamResultPage from './pages/ExamResultPage'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import ParticipantDashboard from './pages/ParticipantDashboard'
import ParticipantLogin from './pages/ParticipantLogin'
import ParticipantQuizAttemptPage from './pages/ParticipantQuizAttemptPage'
import ParticipantQuizResultPage from './pages/ParticipantQuizResultPage'
import CodingAssessmentAttempt from './pages/participant/CodingAssessmentAttempt'
import CodingAssessmentResultPage from './pages/participant/CodingAssessmentResultPage'
import CodingExamShell from './pages/participant/CodingExamShell'
import PreExamReadiness from './pages/PreExamReadiness'
import Register from './pages/Register'
import TrainerDashboard from './pages/TrainerDashboard'
import TrainerLogin from './pages/TrainerLogin'
import TrainerRecordings from './pages/TrainerRecordings'
import TrainerRecordingDetail from './pages/TrainerRecordingDetail'
import TrainerProctoringPage from './pages/TrainerProctoringPage'
import TrainerMonitoringReportPage from './pages/TrainerMonitoringReportPage'
import TrainerQuizDetails from './pages/TrainerQuizDetails'
import TestPage from './pages/TestPage'
import TestResultPage from './pages/TestResultPage'
import TrainerMonitoringDashboard from './pages/TrainerMonitoringDashboard'
import CodingAssessmentBuilder from './pages/trainer/CodingAssessmentBuilder'
import CodingRecordings from './pages/trainer/CodingRecordings'
import CodingRecordingViewer from './pages/trainer/CodingRecordingViewer'

// ─── Coding Assessment route wrappers ────────────────────────────────────────
function ParticipantCodingPage() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const lessonCodingId = location.state?.lessonCodingId
  const handleExit = async () => {
    if (lessonCodingId) {
      try {
        const token = localStorage.getItem('token')
        await fetch(`/api/lessons/coding-assessments/${lessonCodingId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        })
      } catch {}
    }
    navigate('/participant')
  }
  return <div className="p-4"><AssessmentLobby assessmentId={assessmentId} onExit={handleExit} /></div>
}
function TrainerCodingFormPage() {
  const navigate = useNavigate()
  return <div className="p-4"><CodingAssessmentForm onClose={() => navigate('/trainer')} /></div>
}
function TrainerCodingResultsPage() {
  const { assessmentId } = useParams()
  return <div className="p-4"><CodingAssessmentResults assessmentId={assessmentId} /></div>
}

function FullScreenLoader() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(135deg, #f5f8ff 0%, #eef3ff 50%, #f8faff 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: "'Manrope', 'Poppins', sans-serif"
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        border: '3px solid rgba(37, 99, 235, 0.1)',
        borderTop: '3px solid #2563eb',
        borderRadius: '50%',
        animation: 'appSpin 1s linear infinite',
        marginBottom: '16px'
      }} />
      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        color: '#475569',
        letterSpacing: '0.01em',
        animation: 'appPulse 1.5s ease-in-out infinite'
      }}>
        Initializing LMS Workspace...
      </div>
      <style>{`
        @keyframes appSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes appPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        localStorage.removeItem('user')
      }
    }
    setInitializing(false)
  }, [])

  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.status === 401 || response.status === 403) {
        const urlStr = response.url || ''
        const isAuthEndpoint = urlStr.includes('/api/auth/login') || urlStr.includes('/api/auth/register')
        if (!isAuthEndpoint) {
          let shouldLogout = response.status === 401; // Always log out on 401
          if (response.status === 403) {
            try {
              const clone = response.clone();
              const data = await clone.json();
              const errMsg = (data?.error || '').toLowerCase();
              if (errMsg.includes('token') || errMsg.includes('expired') || errMsg.includes('auth')) {
                shouldLogout = true;
              }
            } catch (e) {
              // Ignore JSON parse errors for non-JSON 403 responses
            }
          }
          if (shouldLogout) {
            localStorage.removeItem('user')
            setUser(null)
          }
        }
      }
      return response
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
  }

  if (initializing) {
    return <FullScreenLoader />
  }

  return (
    <AppThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes user={user} onLogin={handleLogin} onLogout={handleLogout} />
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AppThemeProvider>
  )
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 }
}

const DEFAULT_TABS = {
  ADMIN: 'overview',
  TRAINER: 'courses',
  PARTICIPANT: 'overview',
}

// ─── TrainerCodingRecordingViewerWrapper ───────────────────────────────────────
function TrainerCodingRecordingViewerWrapper({ user, onLogout, pageVariants }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('recordings')

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    navigate('/trainer')
  }

  return (
    <Layout user={user} activeTab={activeTab} onTabChange={handleTabChange} onLogout={onLogout}>
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <CodingRecordingViewer user={user} />
      </motion.div>
    </Layout>
  )
}

// ─── TrainerCodingRecordingsWrapper ────────────────────────────────────────────
function TrainerCodingRecordingsWrapper({ user, onLogout, pageVariants }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('recordings')

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    navigate('/trainer')
  }

  return (
    <Layout user={user} activeTab={activeTab} onTabChange={handleTabChange} onLogout={onLogout}>
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <CodingRecordings user={user} />
      </motion.div>
    </Layout>
  )
}

// ─── TrainerRecordingsWrapper ───────────────────────────────────────────────────
function TrainerRecordingsWrapper({ user, onLogout, pageVariants }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('recordings')

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    navigate('/trainer')
  }

  return (
    <Layout user={user} activeTab={activeTab} onTabChange={handleTabChange} onLogout={onLogout}>
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <TrainerRecordings user={user} />
      </motion.div>
    </Layout>
  )
}

// ─── RecordingDetailWrapper ─────────────────────────────────────────────────────
function RecordingDetailWrapper({ user, onLogout, pageVariants }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('recordings')

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    navigate('/trainer')
  }

  return (
    <Layout user={user} activeTab={activeTab} onTabChange={handleTabChange} onLogout={onLogout}>
      <motion.div
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <TrainerRecordingDetail user={user} />
      </motion.div>
    </Layout>
  )
}

// ─── DashboardWrapper ─────────────────────────────────────────────────────────
// activeTab state is LOCAL to each DashboardWrapper instance so it never bleeds
// across routes. When navigating from /admin to /participant the old wrapper
// unmounts and a fresh one mounts with a clean tab, eliminating the hook-
// dispatcher corruption that the shared-state pattern caused.
function DashboardWrapper({ component: Component, user, onLogout }) {
  const [activeTab, setActiveTab] = useState(DEFAULT_TABS[user?.role] || 'overview')

  return (
    <ErrorBoundary>
      <Layout
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={onLogout}
        headerSlot={user?.role === 'PARTICIPANT' || user?.role === 'ADMIN' ? <NotificationsPanel placement="top" /> : null}
      >
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Component
            user={user}
            onLogout={onLogout}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </motion.div>
      </Layout>
    </ErrorBoundary>
  )
}

// ─── AppRoutes ────────────────────────────────────────────────────────────────
// AnimatePresence removed from wrapping <Routes> — page transitions handled
// inside DashboardWrapper. Each route's tab state is self-contained.
function AppRoutes({ user, onLogin, onLogout }) {

  return (
    <Routes>
      <Route path="/" element={<Login onLogin={onLogin} />} />
      <Route path="/login" element={<Login onLogin={onLogin} />} />
      <Route
        path="/admin/login"
        element={
          user?.role === 'ADMIN' ? (
            <Navigate to="/admin" replace />
          ) : (
            <Login onLogin={onLogin} defaultRole="ADMIN" />
          )
        }
      />
      <Route
        path="/trainer/login"
        element={
          user?.role === 'TRAINER' ? (
            <Navigate to="/trainer" replace />
          ) : (
            <Login onLogin={onLogin} defaultRole="TRAINER" />
          )
        }
      />
      <Route
        path="/participant/login"
        element={
          user?.role === 'PARTICIPANT' ? (
            <Navigate to="/participant" replace />
          ) : (
            <Login onLogin={onLogin} defaultRole="PARTICIPANT" />
          )
        }
      />
      <Route path="/register" element={<Register onLogin={onLogin} />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route
        path="/admin"
        element={
          user?.role === 'ADMIN' ? (
            <DashboardWrapper component={AdminDashboard} user={user} onLogout={onLogout} />
          ) : (
            <Navigate to="/login" state={{ fromRole: 'ADMIN' }} replace />
          )
        }
      />

      <Route
        path="/admin/recordings"
        element={
          user?.role === 'ADMIN' ? (
            <AdminRecordings user={user} />
          ) : (
            <Navigate to="/login" state={{ fromRole: 'ADMIN' }} replace />
          )
        }
      />

      <Route
        path="/trainer"
        element={
          user?.role === 'TRAINER' ? (
            <DashboardWrapper component={TrainerDashboard} user={user} onLogout={onLogout} />
          ) : (
            <Navigate to="/login" state={{ fromRole: 'TRAINER' }} replace />
          )
        }
      />

      <Route
        path="/trainer/recordings"
        element={
          user?.role === 'TRAINER' ? (
            <TrainerRecordingsWrapper user={user} onLogout={onLogout} pageVariants={pageVariants} />
          ) : (
            <Navigate to="/login" state={{ fromRole: 'TRAINER' }} replace />
          )
        }
      />

      <Route
        path="/trainer/assessments/recordings"
        element={
          user?.role === 'TRAINER' ? (
            <TrainerCodingRecordingsWrapper user={user} onLogout={onLogout} pageVariants={pageVariants} />
          ) : (
            <Navigate to="/login" state={{ fromRole: 'TRAINER' }} replace />
          )
        }
      />

      <Route
        path="/trainer/assessments/recordings/:id"
        element={
          user?.role === 'TRAINER' ? (
            <TrainerCodingRecordingViewerWrapper user={user} onLogout={onLogout} pageVariants={pageVariants} />
          ) : (
            <Navigate to="/login" state={{ fromRole: 'TRAINER' }} replace />
          )
        }
      />

      <Route
        path="/trainer/recordings/:id"
        element={
          user?.role === 'TRAINER' ? (
            <RecordingDetailWrapper user={user} onLogout={onLogout} pageVariants={pageVariants} />
          ) : (
            <Navigate to="/login" state={{ fromRole: 'TRAINER' }} replace />
          )
        }
      />

      <Route
        path="/participant"
        element={
          user?.role === 'PARTICIPANT' ? (
            <DashboardWrapper component={ParticipantDashboard} user={user} onLogout={onLogout} />
          ) : (
            <Navigate to="/login" state={{ fromRole: 'PARTICIPANT' }} replace />
          )
        }
      />

      <Route
        path="/participant/quizzes"
        element={<Navigate to="/participant" replace />}
      />

      <Route
        path="/quizzes"
        element={<Navigate to="/participant" replace />}
      />

      <Route
        path="/trainings/:trainingId/quizzes/:quizId/attempt"
        element={
          user?.role === 'PARTICIPANT' ? (
            <ParticipantQuizAttemptPage user={user} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/trainings/:trainingId/quizzes/:quizId/result"
        element={
          user?.role === 'PARTICIPANT' ? (
            <Layout
              user={user}
              onLogout={onLogout}
              activeTab="myEnrollments"
              onTabChange={() => window.location.href = '/participant'}
            >
              <ParticipantQuizResultPage user={user} />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/participant/exam/:quizId"
        element={
          user?.role === 'PARTICIPANT'
            ? <PreExamReadiness />
            : <Navigate to="/participant" />
        }
      />

      <Route path="/exam/:sessionId" element={<ExamPage />} />
      <Route path="/exam/:sessionId/result" element={<ExamResultPage />} />

      <Route
        path="/trainer/proctor/:quizId"
        element={
          (user?.role === 'TRAINER' || user?.role === 'ADMIN')
            ? <TrainerProctoringPage />
            : <Navigate to="/trainer" />
        }
      />

      <Route
        path="/trainer/monitoring"
        element={
          (user?.role === 'TRAINER' || user?.role === 'ADMIN')
            ? <TrainerMonitoringDashboard user={user} />
            : <Navigate to="/trainer" />
        }
      />

      <Route
        path="/test/:testId"
        element={
          user?.role === 'PARTICIPANT'
            ? <TestPage user={user} />
            : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/test/:testId/result/:attemptId"
        element={
          user?.role === 'PARTICIPANT'
            ? <TestResultPage />
            : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/trainer/proctor/:quizId/report"
        element={
          (user?.role === 'TRAINER' || user?.role === 'ADMIN')
            ? <TrainerMonitoringReportPage />
            : <Navigate to="/trainer" />
        }
      />

      <Route
        path="/trainer/quiz/:quizId"
        element={
          (user?.role === 'TRAINER' || user?.role === 'ADMIN')
            ? <TrainerQuizDetails user={user} onLogout={onLogout} />
            : <Navigate to="/trainer" />
        }
      />

      <Route
        path="/participant/coding/:assessmentId"
        element={user?.role === 'PARTICIPANT' ? <ParticipantCodingPage /> : <Navigate to="/participant" />}
      />

      <Route
        path="/trainings/:trainingId/assessments/:assessmentId/attempt"
        element={
          user?.role === 'PARTICIPANT' ? (
            <CodingAssessmentAttempt user={user} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/trainings/:trainingId/assessments/:assessmentId/result"
        element={
          user?.role === 'PARTICIPANT' ? (
            <Layout
              user={user}
              onLogout={onLogout}
              activeTab="myEnrollments"
              onTabChange={() => window.location.href = '/participant'}
            >
              <CodingAssessmentResultPage />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/trainings/:trainingId/assessments/:assessmentId/exam"
        element={
          user?.role === 'PARTICIPANT' ? (
            <CodingExamShell />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/trainer/coding"
        element={user?.role === 'TRAINER' ? <TrainerCodingFormPage /> : <Navigate to="/trainer" />}
      />
      <Route
        path="/trainer/coding/:assessmentId/results"
        element={(user?.role === 'TRAINER' || user?.role === 'ADMIN') ? <TrainerCodingResultsPage /> : <Navigate to="/trainer" />}
      />

      <Route
        path="/trainer/trainings/:trainingId/assessments/create"
        element={(user?.role === 'TRAINER' || user?.role === 'ADMIN') ? <CodingAssessmentBuilder /> : <Navigate to="/trainer" />}
      />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default App