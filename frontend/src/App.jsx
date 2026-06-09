import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ToastProvider } from './components/Toast'
import { AppThemeProvider } from './context/AppThemeContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import AdminLogin from './pages/AdminLogin'
import TrainerLogin from './pages/TrainerLogin'
import ParticipantLogin from './pages/ParticipantLogin'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import AdminDashboard from './pages/AdminDashboard'
import TrainerDashboard from './pages/TrainerDashboard'
import ParticipantDashboard from './pages/ParticipantDashboard'
import ParticipantQuizzes from './pages/ParticipantQuizzes'
import PreExamReadiness from './pages/PreExamReadiness'
import ExamPage from './pages/ExamPage'
import ExamResultPage from './pages/ExamResultPage'
import TrainerProctoringPage from './pages/TrainerProctoringPage'
import NotificationsPanel from './components/student/shell/NotificationsPanel'
import AssessmentLobby from './components/coding-assessment/AssessmentLobby'
import CodingAssessmentForm from './components/coding-assessment/CodingAssessmentForm'
import CodingAssessmentResults from './components/coding-assessment/CodingAssessmentResults'

// Coding Assessment route wrappers (read :assessmentId from the URL)
function ParticipantCodingPage() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  return <div className="p-4"><AssessmentLobby assessmentId={assessmentId} onExit={() => navigate('/participant')} /></div>
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
      fontFamily: "'Manrope', 'Inter', sans-serif"
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
          <AppRoutes user={user} onLogin={handleLogin} onLogout={handleLogout} />
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

function DashboardWrapper({ component: Component, user, onLogout, defaultTab, activeTab, onTabChange }) {
  useEffect(() => {
    if (defaultTab && activeTab === 'overview' && user?.role !== 'ADMIN' && user?.role !== 'PARTICIPANT') {
      onTabChange(defaultTab)
    } else if (user?.role === 'PARTICIPANT' && !['overview', 'available', 'myEnrollments', 'lessons', 'ai-quizzes', 'coding', 'feedback', 'myFeedbacks', 'leaderboard', 'achievements', 'profile'].includes(activeTab)) {
      onTabChange(defaultTab)
    } else if (user?.role === 'TRAINER' && !['courses', 'trainings', 'notes', 'ai-quiz', 'coding', 'feedback', 'profile'].includes(activeTab)) {
      onTabChange(defaultTab)
    } else if (user?.role === 'ADMIN' && !['overview', 'programs', 'pending', 'trainings', 'trainers', 'participants', 'sessions', 'notes', 'feedback', 'surveys', 'createTrainer', 'createTraining'].includes(activeTab)) {
      onTabChange(defaultTab)
    }
  }, [user?.role, defaultTab, activeTab, onTabChange])

  return (
    <ErrorBoundary>
      <Layout
        user={user}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onLogout={onLogout}
        headerSlot={user?.role === 'PARTICIPANT' ? <NotificationsPanel /> : null}
      >
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Component user={user} onLogout={onLogout} activeTab={activeTab} onTabChange={onTabChange} />
        </motion.div>
      </Layout>
    </ErrorBoundary>
  )
}

function AppRoutes({ user, onLogin, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview')
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin onLogin={onLogin} />} />
        <Route path="/trainer/login" element={<TrainerLogin onLogin={onLogin} />} />
        <Route path="/participant/login" element={<ParticipantLogin onLogin={onLogin} />} />
        <Route path="/register" element={<Register onLogin={onLogin} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/admin"
          element={
            user?.role === 'ADMIN' ? (
              <DashboardWrapper component={AdminDashboard} user={user} onLogout={onLogout} defaultTab="overview" activeTab={activeTab} onTabChange={setActiveTab} />
            ) : (
              <Navigate to="/admin/login" />
            )
          }
        />

        <Route
          path="/trainer"
          element={
            user?.role === 'TRAINER' ? (
              <DashboardWrapper component={TrainerDashboard} user={user} onLogout={onLogout} defaultTab="courses" activeTab={activeTab} onTabChange={setActiveTab} />
            ) : (
              <Navigate to="/trainer/login" />
            )
          }
        />

        <Route
          path="/participant"
          element={
            user?.role === 'PARTICIPANT' ? (
              <DashboardWrapper component={ParticipantDashboard} user={user} onLogout={onLogout} defaultTab="overview" activeTab={activeTab} onTabChange={setActiveTab} />
            ) : (
              <Navigate to="/participant/login" />
            )
          }
        />

        <Route
          path="/participant/quizzes"
          element={
            user?.role === 'PARTICIPANT' ? (
              <Layout user={user} onLogout={onLogout}>
                <ParticipantQuizzes user={user} />
              </Layout>
            ) : (
              <Navigate to="/participant/login" />
            )
          }
        />

        {/* Pre-exam readiness page (gate). Auth-guarded inside the component. */}
        <Route
          path="/participant/exam/:quizId"
          element={
            user?.role === 'PARTICIPANT'
              ? <PreExamReadiness />
              : <Navigate to="/participant/login" />
          }
        />

        {/* Classical exam page (active session). Auth handled inside the page. */}
        <Route path="/exam/:sessionId" element={<ExamPage />} />
        <Route path="/exam/:sessionId/result" element={<ExamResultPage />} />

        {/* Trainer live proctoring dashboard */}
        <Route
          path="/trainer/proctor/:quizId"
          element={
            (user?.role === 'TRAINER' || user?.role === 'ADMIN')
              ? <TrainerProctoringPage />
              : <Navigate to="/trainer/login" />
          }
        />

        {/* Coding Assessment module */}
        <Route path="/participant/coding/:assessmentId"
          element={user?.role === 'PARTICIPANT' ? <ParticipantCodingPage /> : <Navigate to="/participant/login" />} />
        <Route path="/trainer/coding"
          element={user?.role === 'TRAINER' ? <TrainerCodingFormPage /> : <Navigate to="/trainer/login" />} />
        <Route path="/trainer/coding/:assessmentId/results"
          element={(user?.role === 'TRAINER' || user?.role === 'ADMIN') ? <TrainerCodingResultsPage /> : <Navigate to="/trainer/login" />} />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </AnimatePresence>
  )
}

export default App
