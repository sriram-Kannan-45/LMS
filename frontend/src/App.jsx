import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ToastProvider } from './components/Toast'
import { AppThemeProvider } from './context/AppThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
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

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        localStorage.removeItem('user')
      }
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

function AppRoutes({ user, onLogin, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview')
  const location = useLocation()

  const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 }
  }

  const DashboardWrapper = ({ component: Component, user, onLogout, defaultTab }) => {
    useEffect(() => {
      if (defaultTab && activeTab === 'overview' && user?.role !== 'ADMIN' && user?.role !== 'PARTICIPANT') {
        setActiveTab(defaultTab)
      } else if (user?.role === 'PARTICIPANT' && !['overview', 'available', 'myEnrollments', 'lessons', 'ai-quizzes', 'feedback', 'myFeedbacks', 'leaderboard', 'achievements', 'profile'].includes(activeTab)) {
        setActiveTab(defaultTab)
      } else if (user?.role === 'TRAINER' && !['courses', 'trainings', 'notes', 'ai-quiz', 'feedback', 'profile'].includes(activeTab)) {
        setActiveTab(defaultTab)
      } else if (user?.role === 'ADMIN' && !['overview', 'programs', 'pending', 'trainings', 'trainers', 'participants', 'sessions', 'notes', 'feedback', 'surveys', 'createTrainer', 'createTraining'].includes(activeTab)) {
        setActiveTab(defaultTab)
      }
    }, [user?.role, defaultTab])

    return (
      <Layout
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
          <Component user={user} onLogout={onLogout} activeTab={activeTab} onTabChange={setActiveTab} />
        </motion.div>
      </Layout>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login onLogin={onLogin} />} />
        <Route path="/register" element={<Register onLogin={onLogin} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          path="/admin"
          element={
            user?.role === 'ADMIN' ? (
              <DashboardWrapper component={AdminDashboard} user={user} onLogout={onLogout} defaultTab="overview" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/trainer"
          element={
            user?.role === 'TRAINER' ? (
              <DashboardWrapper component={TrainerDashboard} user={user} onLogout={onLogout} defaultTab="courses" />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/participant"
          element={
            user?.role === 'PARTICIPANT' ? (
              <DashboardWrapper component={ParticipantDashboard} user={user} onLogout={onLogout} defaultTab="overview" />
            ) : (
              <Navigate to="/login" />
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
              <Navigate to="/login" />
            )
          }
        />

        {/* Pre-exam readiness page (gate). Auth-guarded inside the component. */}
        <Route
          path="/participant/exam/:quizId"
          element={
            user?.role === 'PARTICIPANT'
              ? <PreExamReadiness />
              : <Navigate to="/login" />
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
              : <Navigate to="/login" />
          }
        />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </AnimatePresence>
  )
}

export default App
