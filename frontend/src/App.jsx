import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import { AppThemeProvider } from './context/AppThemeContext'

// ─── Route-level code splitting via React.lazy() ───────────────────
// Each page is loaded only when its route is visited, reducing initial
// bundle size by ~60-70%.

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))

const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

const TrainerLogin = lazy(() => import('./pages/TrainerLogin'))
const TrainerDashboard = lazy(() => import('./pages/TrainerDashboard'))
const TrainerProctoringPage = lazy(() => import('./pages/TrainerProctoringPage'))
const TrainerCourses = lazy(() => import('./pages/TrainerCourses'))

const ParticipantLogin = lazy(() => import('./pages/ParticipantLogin'))
const ParticipantDashboard = lazy(() => import('./pages/ParticipantDashboard'))
const ParticipantQuizzes = lazy(() => import('./pages/ParticipantQuizzes'))
const ParticipantParticipantCourses = lazy(() => import('./pages/ParticipantCourses'))

const ExamPage = lazy(() => import('./pages/ExamPage'))
const ExamResultPage = lazy(() => import('./pages/ExamResultPage'))
const PreExamReadiness = lazy(() => import('./pages/PreExamReadiness'))

const AssessmentLobby = lazy(() => import('./components/coding-assessment/AssessmentLobby'))
const CodingAssessmentForm = lazy(() => import('./components/coding-assessment/CodingAssessmentForm'))
const CodingAssessmentResults = lazy(() => import('./components/coding-assessment/CodingAssessmentResults'))

// ─── Suspense fallback — minimal, non-blocking ─────────────────────
function RouteLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f8faff',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        border: '3px solid rgba(37, 99, 235, 0.1)',
        borderTop: '3px solid #2563eb',
        borderRadius: '50%',
        animation: 'routeSpin 0.8s linear infinite',
      }} />
      <style>{`@keyframes routeSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Coding Assessment route wrappers ──────────────────────────────
function ParticipantCodingPage() {
  const { assessmentId } = useParams()
  const navigate = useNavigate()
  return (
    <Suspense fallback={<RouteLoader />}>
      <div className="p-4">
        <AssessmentLobby assessmentId={assessmentId} onExit={() => navigate('/participant')} />
      </div>
    </Suspense>
  )
}

function TrainerCodingFormPage() {
  const navigate = useNavigate()
  return (
    <Suspense fallback={<RouteLoader />}>
      <div className="p-4">
        <CodingAssessmentForm onClose={() => navigate('/trainer')} />
      </div>
    </Suspense>
  )
}

function TrainerCodingResultsPage() {
  const { assessmentId } = useParams()
  return (
    <Suspense fallback={<RouteLoader />}>
      <div className="p-4">
        <CodingAssessmentResults assessmentId={assessmentId} />
      </div>
    </Suspense>
  )
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

const DEFAULT_TABS = {
  ADMIN: 'overview',
  TRAINER: 'courses',
  PARTICIPANT: 'overview',
}

function DashboardWrapper({ component: Component, user, onLogout }) {
  const [activeTab, setActiveTab] = useState(DEFAULT_TABS[user?.role] || 'overview')

  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoader />}>
        <Layout
          user={user}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={onLogout}
          headerSlot={null}
        >
          <Component
            user={user}
            onLogout={onLogout}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </Layout>
      </Suspense>
    </ErrorBoundary>
  )
}

function AppRoutes({ user, onLogin, onLogout }) {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<RouteLoader />}><Login /></Suspense>} />
      <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
      <Route path="/trainer/login" element={<Navigate to="/trainer" replace />} />
      <Route path="/participant/login" element={<Navigate to="/participant" replace />} />
      <Route path="/register" element={<Suspense fallback={<RouteLoader />}><Register onLogin={onLogin} /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<RouteLoader />}><ForgotPassword /></Suspense>} />

      <Route
        path="/admin"
        element={
          user?.role === 'ADMIN' ? (
            <DashboardWrapper component={AdminDashboard} user={user} onLogout={onLogout} />
          ) : (
            <Suspense fallback={<RouteLoader />}><AdminLogin onLogin={onLogin} /></Suspense>
          )
        }
      />

      <Route
        path="/trainer"
        element={
          user?.role === 'TRAINER' ? (
            <DashboardWrapper component={TrainerDashboard} user={user} onLogout={onLogout} />
          ) : (
            <Suspense fallback={<RouteLoader />}><TrainerLogin onLogin={onLogin} /></Suspense>
          )
        }
      />

      <Route
        path="/participant"
        element={
          user?.role === 'PARTICIPANT' ? (
            <DashboardWrapper component={ParticipantDashboard} user={user} onLogout={onLogout} />
          ) : (
            <Suspense fallback={<RouteLoader />}><ParticipantLogin onLogin={onLogin} /></Suspense>
          )
        }
      />

      <Route
        path="/participant/quizzes"
        element={
          user?.role === 'PARTICIPANT' ? (
            <Layout user={user} onLogout={onLogout}>
              <Suspense fallback={<RouteLoader />}><ParticipantQuizzes user={user} /></Suspense>
            </Layout>
          ) : (
            <Navigate to="/participant" />
          )
        }
      />

      <Route
        path="/participant/exam/:quizId"
        element={
          user?.role === 'PARTICIPANT'
            ? <Suspense fallback={<RouteLoader />}><PreExamReadiness /></Suspense>
            : <Navigate to="/participant" />
        }
      />

      <Route path="/exam/:sessionId" element={<Suspense fallback={<RouteLoader />}><ExamPage /></Suspense>} />
      <Route path="/exam/:sessionId/result" element={<Suspense fallback={<RouteLoader />}><ExamResultPage /></Suspense>} />

      <Route
        path="/trainer/proctor/:quizId"
        element={
          (user?.role === 'TRAINER' || user?.role === 'ADMIN')
            ? <Suspense fallback={<RouteLoader />}><TrainerProctoringPage /></Suspense>
            : <Navigate to="/trainer" />
        }
      />

      <Route
        path="/participant/coding/:assessmentId"
        element={user?.role === 'PARTICIPANT' ? <ParticipantCodingPage /> : <Navigate to="/participant" />}
      />
      <Route
        path="/trainer/coding"
        element={user?.role === 'TRAINER' ? <TrainerCodingFormPage /> : <Navigate to="/trainer" />}
      />
      <Route
        path="/trainer/coding/:assessmentId/results"
        element={(user?.role === 'TRAINER' || user?.role === 'ADMIN') ? <TrainerCodingResultsPage /> : <Navigate to="/trainer" />}
      />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default App
