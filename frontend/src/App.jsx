import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
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
import ExamPage from './pages/ExamPage'
import ExamResultPage from './pages/ExamResultPage'
import ForgotPassword from './pages/ForgotPassword'
import Login from './pages/Login'
import ParticipantDashboard from './pages/ParticipantDashboard'
import ParticipantLogin from './pages/ParticipantLogin'
import ParticipantQuizzes from './pages/ParticipantQuizzes'
import PreExamReadiness from './pages/PreExamReadiness'
import Register from './pages/Register'
import TrainerDashboard from './pages/TrainerDashboard'
import TrainerLogin from './pages/TrainerLogin'
import TrainerProctoringPage from './pages/TrainerProctoringPage'

// ─── Coding Assessment route wrappers ────────────────────────────────────────
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
        headerSlot={user?.role === 'PARTICIPANT' ? <NotificationsPanel placement="top" /> : null}
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
            <DashboardWrapper component={AdminDashboard} user={user} onLogout={onLogout} />
          ) : (
            <Navigate to="/admin/login" />
          )
        }
      />

      <Route
        path="/trainer"
        element={
          user?.role === 'TRAINER' ? (
            <DashboardWrapper component={TrainerDashboard} user={user} onLogout={onLogout} />
          ) : (
            <Navigate to="/trainer/login" />
          )
        }
      />

      <Route
        path="/participant"
        element={
          user?.role === 'PARTICIPANT' ? (
            <DashboardWrapper component={ParticipantDashboard} user={user} onLogout={onLogout} />
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

      <Route
        path="/participant/exam/:quizId"
        element={
          user?.role === 'PARTICIPANT'
            ? <PreExamReadiness />
            : <Navigate to="/participant/login" />
        }
      />

      <Route path="/exam/:sessionId" element={<ExamPage />} />
      <Route path="/exam/:sessionId/result" element={<ExamResultPage />} />

      <Route
        path="/trainer/proctor/:quizId"
        element={
          (user?.role === 'TRAINER' || user?.role === 'ADMIN')
            ? <TrainerProctoringPage />
            : <Navigate to="/trainer/login" />
        }
      />

      <Route
        path="/participant/coding/:assessmentId"
        element={user?.role === 'PARTICIPANT' ? <ParticipantCodingPage /> : <Navigate to="/participant/login" />}
      />
      <Route
        path="/trainer/coding"
        element={user?.role === 'TRAINER' ? <TrainerCodingFormPage /> : <Navigate to="/trainer/login" />}
      />
      <Route
        path="/trainer/coding/:assessmentId/results"
        element={(user?.role === 'TRAINER' || user?.role === 'ADMIN') ? <TrainerCodingResultsPage /> : <Navigate to="/trainer/login" />}
      />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default App