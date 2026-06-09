import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, EyeOff, Mail, Lock, Shield, GraduationCap, User,
  CheckCircle2, AlertCircle, ArrowRight, Loader2,
  Sparkles, TrendingUp, Lightbulb, Bot
} from 'lucide-react'
import { useToast } from '../components/Toast'
import { API } from '../api/api'
import loginIllustration from '../assets/login-illustration.png'

/* ─── Floating AI Cards Data (Tailored for Participant role) ─── */
const AI_CARDS = [
  {
    id: 'personalized',
    icon: Sparkles,
    title: 'Personalized Learning',
    subtitle: 'Tailored to your pace',
    accent: '#3b82f6',
    pos: { top: '6%', left: '3%' },
    from: { x: -40, y: -20 },
  },
  {
    id: 'progress',
    icon: TrendingUp,
    title: 'Track Progress',
    subtitle: '+24% this week',
    accent: '#22c55e',
    pos: { top: '8%', right: '4%' },
    from: { x: 40, y: -20 },
  },
  {
    id: 'recommend',
    icon: Lightbulb,
    title: 'Smart Recommendations',
    subtitle: '12 new lessons for you',
    accent: '#a855f7',
    pos: { top: '42%', right: '3%' },
    from: { x: 40, y: 20 },
  },
]

function AIFloatingCards({ visible }) {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.12, delayChildren: 0.05 },
    },
    exit: {
      transition: { staggerChildren: 0.06, staggerDirection: -1 },
    },
  }

  const cardVariants = (from) => ({
    hidden: { opacity: 0, scale: 0.8, x: from.x, y: from.y },
    visible: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      transition: { type: 'spring', stiffness: 220, damping: 22 },
    },
    exit: {
      opacity: 0,
      scale: 0.85,
      x: from.x * 0.5,
      y: from.y * 0.5,
      transition: { duration: 0.25, ease: 'easeIn' },
    },
  })

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="ai-cards-layer"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* AI Assistant speech bubble — floats above-left of robot */}
          <motion.div
            className="ai-bubble"
            style={{ bottom: '34%', left: '22%' }}
            variants={{
              hidden: { opacity: 0, scale: 0.85, y: 16, x: -8 },
              visible: {
                opacity: 1,
                scale: 1,
                y: 0,
                x: 0,
                transition: { type: 'spring', stiffness: 260, damping: 20, delay: 0.08 },
              },
              exit: {
                opacity: 0,
                scale: 0.88,
                y: 10,
                transition: { duration: 0.2, ease: 'easeIn' },
              },
            }}
          >
            <div className="ai-bubble-inner">
              <div className="ai-bubble-avatar">
                <Bot size={14} strokeWidth={2.4} />
              </div>
              <div className="ai-bubble-body">
                <span className="ai-bubble-title">AI Assistant</span>
                <span className="ai-bubble-text">How can I help you learn today?</span>
              </div>
            </div>
            {/* tail points down-right toward robot */}
            <span className="ai-bubble-tail" />
          </motion.div>

          {/* Feature cards */}
          {AI_CARDS.map(({ id, icon: Icon, title, subtitle, accent, pos, from }) => (
            <motion.div
              key={id}
              className="ai-feature-card"
              style={{ ...pos, '--card-accent': accent }}
              variants={cardVariants(from)}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <div className="ai-feature-icon">
                <Icon size={16} strokeWidth={2.4} />
              </div>
              <div className="ai-feature-text">
                <span className="ai-feature-title">{title}</span>
                <span className="ai-feature-sub">{subtitle}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ParticipantLogin({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '', role: 'PARTICIPANT' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [aiCardsVisible, setAiCardsVisible] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  const { success: showSuccess, error: showError } = useToast()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Lock the scroll
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlHeight = document.documentElement.style.height
    const prevBodyHeight = document.body.style.height
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'

    // Remember current role route context
    localStorage.setItem('lastRole', 'PARTICIPANT')

    // Load remembered email if exists
    const remembered = localStorage.getItem('rememberedEmail')
    const remember = localStorage.getItem('rememberMe') === 'true'
    if (remember && remembered) {
      setForm(p => ({ ...p, email: remembered }))
      setRememberMe(true)
    }

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.height = prevHtmlHeight
      document.body.style.height = prevBodyHeight
    }
  }, [])

  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message)
      showSuccess(location.state.message)
      setTimeout(() => setSuccess(''), 3000)
    }
  }, [location.state, showSuccess])

  const validateForm = () => {
    if (!form.email) {
      setError('Email address or Username is required')
      showError('Email address or Username is required')
      return false
    }
    if (!form.password) {
      setError('Password is required')
      showError('Password is required')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validateForm()) return

    setLoading(true)
    try {
      const res = await fetch(API.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      let data
      try { data = await res.json() } catch { throw new Error('Server error or unavailable. Please try again.') }

      if (!res.ok) {
        if (res.status === 403 && data.error?.includes('pending')) throw new Error('⏳ Your account is pending approval')
        else throw new Error(data.error || 'Login failed')
      }

      localStorage.setItem('user', JSON.stringify(data))
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true')
        localStorage.setItem('rememberedEmail', form.email)
      } else {
        localStorage.removeItem('rememberMe')
        localStorage.removeItem('rememberedEmail')
      }

      setSuccess('Welcome! Redirecting to classroom...')
      showSuccess('Welcome! Redirecting to classroom...')
      onLogin(data)

      setTimeout(() => {
        navigate('/participant')
      }, 500)
    } catch (err) {
      const msg = err.message === 'Failed to fetch' ? 'Cannot connect to server.' : err.message
      setError(msg)
      showError(msg)
    } finally { setLoading(false) }
  }

  return (
    <div className="classic-login-page">
      {/* ─── LEFT VISUAL PANEL ─── */}
      <aside className="login-visual-panel">
        <div className="visual-bg-gradient" />
        <div className="visual-glow visual-glow-1" />
        <div className="visual-glow visual-glow-2" />

        <motion.div
          className="visual-image-wrap"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <img
            src={loginIllustration}
            alt="AI-powered learning illustration"
            className="visual-image"
            draggable={false}
          />
          <div className="visual-image-overlay" />
        </motion.div>

        {/* Interactive robot hotspot */}
        <motion.button
          type="button"
          className={`robot-hotspot ${aiCardsVisible ? 'is-active' : ''}`}
          onClick={() => setAiCardsVisible(v => !v)}
          aria-label={aiCardsVisible ? 'Hide AI features' : 'Reveal AI features'}
          aria-pressed={aiCardsVisible}
          whileTap={{ scale: 0.94 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
        >
          <span className="robot-hotspot-pulse" />
          <span className="robot-hotspot-pulse robot-hotspot-pulse-2" />
          <span className="robot-hotspot-ring" />
        </motion.button>

        {/* "AI Online" pill */}
        <motion.div
          className="visual-float visual-float-1"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="visual-float-dot" />
          <span>AI Online</span>
        </motion.div>

        {/* Floating AI feature cards */}
        <AIFloatingCards visible={aiCardsVisible} />

        {/* Tap-hint */}
        <AnimatePresence>
          {!aiCardsVisible && (
            <motion.div
              className="robot-tap-hint"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ delay: 1.4, duration: 0.4 }}
            >
              <Sparkles size={12} strokeWidth={2.4} />
              <span>Tap the robot to explore AI features</span>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* ─── RIGHT FORM PANEL ─── */}
      <section className="login-form-panel">
        <div className="classic-login-bg">
          <div className="classic-bg-shape classic-bg-shape-1" />
          <div className="classic-bg-shape classic-bg-shape-2" />
        </div>

        <motion.div
          className="classic-login-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Glassmorphism Card */}
          <div className="classic-login-card">
            <div className="classic-card-accent" />

            <div className="classic-card-body">
              {/* Organization Logo */}
              <div className="classic-logo-header">
                <div className="classic-logo-icon-wrapper">
                  <svg className="classic-logo-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop stopColor="var(--brand-600)" />
                        <stop offset="1" stopColor="var(--brand-400)" />
                      </linearGradient>
                    </defs>
                    <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
                    <path d="M16 8L23 12V20L16 24L9 20V12L16 8Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="16" cy="16" r="2.5" fill="white" />
                    <line x1="16" y1="8" x2="16" y2="13.5" stroke="white" strokeWidth="1.5" />
                    <line x1="9" y1="20" x2="14" y2="17.5" stroke="white" strokeWidth="1.5" />
                    <line x1="23" y1="20" x2="18" y2="17.5" stroke="white" strokeWidth="1.5" />
                  </svg>
                </div>
                <span className="classic-logo-text">feed<span className="classic-logo-highlight">Web</span></span>
              </div>

              {/* Title Header with Icon */}
              <div className="classic-title-section">
                <div className="classic-title-icon-box">
                  <User size={24} />
                </div>
                <div>
                  <h2 className="classic-card-title">Participant Space</h2>
                  <p className="classic-card-subtitle">Interactive Learning & Skills Mastery</p>
                </div>
              </div>

              <div className="classic-welcome-banner">
                Embark on your learning journey, view your course progression, and complete personalized AI quizzes.
              </div>

              {/* Alerts */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="classic-alert classic-alert-error"
                  >
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="classic-alert classic-alert-success"
                  >
                    <CheckCircle2 size={16} />
                    <span>{success}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit}>
                {/* Email Field */}
                <div className={`classic-field ${focusedField === 'email' ? 'focused' : ''}`}>
                  <label htmlFor="login-email" className="classic-label">Username or Email</label>
                  <div className="classic-input-wrapper">
                    <Mail size={18} className="classic-input-icon" />
                    <input
                      id="login-email"
                      type="text"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="you@example.com"
                      autoComplete="username"
                      className="classic-input"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className={`classic-field ${focusedField === 'password' ? 'focused' : ''}`}>
                  <label htmlFor="login-password" className="classic-label">Password</label>
                  <div className="classic-input-wrapper">
                    <Lock size={18} className="classic-input-icon" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="classic-input"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(v => !v)}
                      className="classic-password-toggle"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot */}
                <div className="classic-options-row">
                  <label className="classic-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="classic-checkbox"
                    />
                    <span className="classic-checkmark" />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="classic-forgot-link"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit Button */}
                <motion.button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.01 }}
                  whileTap={{ scale: loading ? 1 : 0.99 }}
                  className="classic-submit-btn"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="classic-spinner" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In as Participant</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Create Account Link (Participant Only) */}
              <p className="classic-register-text">
                Don't have an account?{' '}
                <button type="button" onClick={() => navigate('/register')} className="classic-register-link">
                  Create Account
                </button>
              </p>

              {/* Switch Roles Links */}
              <div className="classic-switch-roles">
                <span className="classic-switch-label">Switch Portal</span>
                <div className="classic-switch-links">
                  <button type="button" onClick={() => navigate('/trainer/login')} className="classic-switch-link">
                    <GraduationCap size={15} />
                    <span>Trainer Hub</span>
                  </button>
                  <button type="button" onClick={() => navigate('/admin/login')} className="classic-switch-link">
                    <Shield size={15} />
                    <span>Admin Portal</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <p className="classic-footer">© 2026 · FeedWeb LMS · Learning Space</p>
        </motion.div>
      </section>

      <style>{`
        :root {
          --brand-50:  #eff6ff;
          --brand-100: #dbeafe;
          --brand-200: #bfdbfe;
          --brand-300: #93c5fd;
          --brand-400: #60a5fa;
          --brand-500: #3b82f6;
          --brand-600: #2563eb;
          --brand-700: #1d4ed8;
          --brand-800: #1e40af;
          --brand-900: #1e3a8a;
          --ink-900: #0f172a;
          --ink-700: #334155;
          --ink-500: #64748b;
          --ink-400: #94a3b8;
          --ink-300: #cbd5e1;
          --ink-200: #e2e8f0;
          --surface: rgba(255, 255, 255, 0.78);
          --surface-strong: rgba(255, 255, 255, 0.92);
        }

        /* Lock the document so the login route never scrolls */
        html:has(.classic-login-page),
        body:has(.classic-login-page) {
          height: 100%;
          margin: 0;
          overflow: hidden;
        }

        .classic-login-page {
          height: 100vh;
          height: 100dvh;
          width: 100%;
          max-width: 100vw;
          display: flex;
          flex-direction: row;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          background: linear-gradient(135deg, #f5f8ff 0%, #eef3ff 50%, #f8faff 100%);
          font-family: 'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-feature-settings: "cv02","cv03","cv04","cv11";
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }

        .classic-login-page *,
        .classic-login-page *::before,
        .classic-login-page *::after {
          box-sizing: border-box;
        }

        /* ─── LEFT — VISUAL PANEL ─── */
        .login-visual-panel {
          flex: 1.35 1 0;
          position: relative;
          overflow: visible;
          isolation: isolate;
          background:
            radial-gradient(ellipse at 25% 20%, rgba(96,165,250,0.25) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 80%, rgba(37,99,235,0.18) 0%, transparent 60%),
            linear-gradient(135deg, #dbeafe 0%, #eef4ff 50%, #f5f9ff 100%);
          clip-path: none;
        }

        .visual-bg-gradient {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 20% 30%, rgba(96,165,250,0.20) 0%, transparent 45%),
            radial-gradient(circle at 80% 70%, rgba(37,99,235,0.14) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        .visual-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
          opacity: 0.55;
        }

        .visual-glow-1 {
          width: 480px;
          height: 480px;
          top: -160px;
          left: -140px;
          background: radial-gradient(circle, rgba(59,130,246,0.55) 0%, transparent 70%);
          animation: visualPulse 9s ease-in-out infinite;
        }

        .visual-glow-2 {
          width: 380px;
          height: 380px;
          bottom: -120px;
          right: -100px;
          background: radial-gradient(circle, rgba(147,197,253,0.55) 0%, transparent 70%);
          animation: visualPulse 11s ease-in-out infinite reverse;
        }

        @keyframes visualPulse {
          0%, 100% { transform: scale(1);    opacity: 0.45; }
          50%      { transform: scale(1.18); opacity: 0.75; }
        }

        .visual-image-wrap {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
          overflow: hidden;
        }

        .visual-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 18% center;
          filter: saturate(1.04) contrast(1.01);
          user-select: none;
          -webkit-user-drag: none;
        }

        .visual-image-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg,
              rgba(37,99,235,0.04) 0%,
              transparent 45%,
              rgba(59,130,246,0.04) 100%);
          pointer-events: none;
        }

        .robot-hotspot {
          position: absolute;
          top: 38%;
          left: 60%;
          width: clamp(80px, 11vw, 130px);
          height: clamp(80px, 11vw, 130px);
          transform: translate(-50%, -50%);
          background: transparent;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          z-index: 5;
          padding: 0;
          outline: none;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }

        .robot-hotspot:hover {
          transform: translate(-50%, -50%) scale(1.08);
        }

        .robot-hotspot:focus-visible {
          outline: 2px solid var(--brand-600);
          outline-offset: 6px;
        }

        .robot-hotspot-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(59,130,246,0.22) 0%,
            rgba(59,130,246,0.12) 45%,
            transparent 72%
          );
          opacity: 0;
          transform: scale(0.85);
          transition:
            opacity 0.35s ease,
            transform 0.35s ease;
          pointer-events: none;
        }

        .robot-hotspot:hover .robot-hotspot-ring,
        .robot-hotspot.is-active .robot-hotspot-ring {
          opacity: 1;
          transform: scale(1.05);
        }

        .robot-hotspot-pulse {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(59,130,246,0.55);
          opacity: 0;
          pointer-events: none;
          animation: robotPulse 2.6s ease-out infinite;
        }

        .robot-hotspot-pulse-2 {
          animation-delay: 1.3s;
        }

        @keyframes robotPulse {
          0% {
            transform: scale(0.6);
            opacity: 0;
            border-color: rgba(59,130,246,0.65);
          }
          25% {
            opacity: 0.85;
          }
          100% {
            transform: scale(1.45);
            opacity: 0;
            border-color: rgba(96,165,250,0.05);
          }
        }

        .robot-hotspot.is-active .robot-hotspot-pulse {
          animation-duration: 3.6s;
          opacity: 0.4;
        }

        .ai-cards-layer {
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
          overflow: visible;
        }

        .ai-cards-layer > * {
          pointer-events: auto;
        }

        .ai-feature-card {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 11px 14px 11px 11px;
          min-width: 180px;
          max-width: 240px;
          background: rgba(255,255,255,0.88);
          border: 1px solid rgba(255,255,255,0.95);
          backdrop-filter: blur(18px) saturate(1.5);
          -webkit-backdrop-filter: blur(18px) saturate(1.5);
          border-radius: 14px;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.95) inset,
            0 8px 24px rgba(37,99,235,0.14),
            0 2px 6px rgba(15,23,42,0.05);
          will-change: transform, opacity;
        }

        .ai-feature-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          background: linear-gradient(135deg,
            var(--card-accent, var(--brand-600)) 0%,
            color-mix(in srgb, var(--card-accent, var(--brand-600)) 70%, #fff) 100%);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.32) inset,
            0 4px 10px color-mix(in srgb, var(--card-accent, #2563eb) 35%, transparent);
          flex-shrink: 0;
        }

        .ai-feature-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .ai-feature-title {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ink-900);
          letter-spacing: -0.005em;
          line-height: 1.15;
        }

        .ai-feature-sub {
          font-size: 11px;
          font-weight: 500;
          color: var(--ink-500);
          line-height: 1.2;
          letter-spacing: 0.005em;
        }

        .ai-bubble {
          position: absolute;
          z-index: 20;
          width: 210px;
          will-change: transform, opacity;
          filter: drop-shadow(0 8px 24px rgba(37,99,235,0.18));
        }

        .ai-bubble-inner {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px 16px 12px;
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(219,234,254,0.9);
          backdrop-filter: blur(20px) saturate(1.6);
          -webkit-backdrop-filter: blur(20px) saturate(1.6);
          border-radius: 16px;
          box-shadow:
            0 1px 0 rgba(255,255,255,1) inset,
            0 4px 6px rgba(15,23,42,0.04),
            0 12px 32px rgba(37,99,235,0.13);
          position: relative;
        }

        .ai-bubble-avatar {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px 4px 8px;
          background: var(--brand-600);
          border-radius: 999px;
          color: #fff;
          width: fit-content;
        }

        .ai-bubble-body {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .ai-bubble-title {
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.01em;
          line-height: 1.2;
        }

        .ai-bubble-text {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink-900);
          line-height: 1.45;
          letter-spacing: 0.005em;
        }

        .ai-bubble-tail {
          position: absolute;
          bottom: -9px;
          right: 28px;
          width: 18px;
          height: 18px;
          background: rgba(255,255,255,0.96);
          border-right: 1px solid rgba(219,234,254,0.9);
          border-bottom: 1px solid rgba(219,234,254,0.9);
          transform: rotate(45deg);
          border-radius: 0 0 4px 0;
        }

        .robot-tap-hint {
          position: absolute;
          bottom: clamp(20px, 4vh, 36px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 6;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(255,255,255,0.92);
          backdrop-filter: blur(14px) saturate(1.4);
          -webkit-backdrop-filter: blur(14px) saturate(1.4);
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--brand-700);
          letter-spacing: 0.005em;
          box-shadow: 0 4px 14px rgba(37,99,235,0.12);
          white-space: nowrap;
          pointer-events: none;
        }

        .visual-float {
          position: absolute;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(255,255,255,0.9);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: var(--brand-700);
          letter-spacing: 0.01em;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.9) inset,
            0 6px 20px rgba(37,99,235,0.14);
        }

        .visual-float-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.18);
          animation: floatDotPulse 2.4s ease-in-out infinite;
        }

        @keyframes floatDotPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.18); }
          50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0.04); }
        }

        .visual-float-1 {
          top: clamp(20px, 4vh, 36px);
          left: clamp(20px, 3vw, 36px);
          z-index: 6;
        }

        /* ─── RIGHT — FORM PANEL ─── */
        .login-form-panel {
          flex: 1 1 0;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 2.5vw, 40px);
          overflow: hidden;
          background:
            radial-gradient(ellipse at 70% 0%, rgba(219,234,254,0.45) 0%, transparent 50%),
            radial-gradient(ellipse at 30% 100%, rgba(191,219,254,0.35) 0%, transparent 55%),
            linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
          min-width: 0;
        }

        .classic-login-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }

        .classic-bg-shape {
          position: absolute;
          border-radius: 50%;
          opacity: 0.55;
          filter: blur(60px);
        }

        .classic-bg-shape-1 {
          width: min(540px, 70%);
          height: min(540px, 70%);
          top: -200px;
          right: -130px;
          background: radial-gradient(circle, rgba(96,165,250,0.18) 0%, transparent 70%);
        }

        .classic-bg-shape-2 {
          width: min(460px, 60%);
          height: min(460px, 60%);
          bottom: -180px;
          left: -110px;
          background: radial-gradient(circle, rgba(147,197,253,0.14) 0%, transparent 70%);
        }

        .classic-login-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 460px;
          max-height: 100%;
          display: flex;
          flex-direction: column;
          gap: clamp(8px, 1.2vh, 14px);
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .classic-login-container::-webkit-scrollbar { display: none; width: 0; height: 0; }

        /* Glassmorphism Card */
        .classic-login-card {
          background: rgba(255,255,255,0.78);
          backdrop-filter: blur(28px) saturate(1.5);
          -webkit-backdrop-filter: blur(28px) saturate(1.5);
          border: 1px solid rgba(255,255,255,0.92);
          border-radius: 24px;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.95) inset,
            0 1px 2px rgba(15,23,42,0.04),
            0 14px 36px rgba(37,99,235,0.09),
            0 28px 72px rgba(37,99,235,0.07);
          overflow: hidden;
          position: relative;
          flex-shrink: 0;
          transition:
            transform 0.45s cubic-bezier(0.16,1,0.3,1),
            box-shadow 0.45s ease;
        }

        .classic-login-card:hover {
          box-shadow:
            0 1px 0 rgba(255,255,255,0.95) inset,
            0 1px 2px rgba(15,23,42,0.04),
            0 18px 44px rgba(37,99,235,0.13),
            0 36px 88px rgba(37,99,235,0.09);
        }

        .classic-card-accent {
          height: 3px;
          background: linear-gradient(90deg, var(--brand-700) 0%, var(--brand-500) 50%, var(--brand-300) 100%);
        }

        .classic-card-body {
          padding: clamp(24px, 3.4vh, 36px) clamp(24px, 4vw, 38px);
        }

        .classic-logo-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: clamp(16px, 2.2vh, 24px);
        }
        .classic-logo-icon-wrapper {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .classic-logo-svg {
          width: 100%;
          height: 100%;
          border-radius: 9px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .classic-logo-text {
          font-family: 'Outfit', 'Inter', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: var(--ink-900);
          letter-spacing: -0.03em;
          display: flex;
          align-items: center;
        }
        .classic-logo-highlight {
          background: linear-gradient(135deg, var(--brand-700) 0%, var(--brand-400) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .classic-title-section {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: clamp(14px, 2vh, 20px);
        }

        .classic-title-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--brand-100);
          color: var(--brand-700);
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(37,99,235,0.1);
        }

        .classic-card-title {
          font-size: clamp(20px, 2.6vh, 24px);
          font-weight: 800;
          color: var(--ink-900);
          font-family: 'Outfit', 'Inter', sans-serif;
          margin: 0;
          letter-spacing: -0.02em;
          line-height: 1.15;
        }

        .classic-card-subtitle {
          font-size: clamp(12px, 1.4vh, 13.5px);
          color: var(--ink-500);
          margin: 2px 0 0;
          font-weight: 500;
          line-height: 1.3;
          letter-spacing: 0.005em;
        }

        .classic-welcome-banner {
          font-size: 13px;
          line-height: 1.5;
          color: var(--ink-700);
          background: rgba(37,99,235,0.04);
          border: 1px solid rgba(37,99,235,0.08);
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: clamp(16px, 2.2vh, 24px);
          font-weight: 500;
        }

        /* Alerts */
        .classic-alert {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 14px;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 500;
          overflow: hidden;
          letter-spacing: 0.005em;
        }

        .classic-alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
        }

        .classic-alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #16a34a;
        }

        /* Form Fields */
        .classic-field {
          margin-bottom: clamp(12px, 1.8vh, 16px);
        }

        .classic-label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-700);
          margin-bottom: 7px;
          letter-spacing: 0.01em;
          line-height: 1.2;
        }

        .classic-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .classic-input-icon {
          position: absolute;
          left: 14px;
          color: var(--ink-400);
          pointer-events: none;
          transition: color 0.25s ease;
          z-index: 1;
        }

        .classic-field.focused .classic-input-icon {
          color: var(--brand-600);
        }

        .classic-input {
          width: 100%;
          height: clamp(44px, 5.6vh, 50px);
          padding: 0 14px 0 44px;
          background: rgba(248,250,252,0.85);
          border: 1.5px solid rgba(226,232,240,0.9);
          border-radius: 13px;
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-900);
          font-family: 'Manrope', 'Inter', sans-serif;
          letter-spacing: 0.005em;
          transition:
            border-color 0.25s ease,
            background 0.25s ease,
            box-shadow 0.25s ease;
          outline: none;
          box-shadow: 0 1px 2px rgba(15,23,42,0.02);
        }

        .classic-input::placeholder {
          color: var(--ink-300);
          font-weight: 400;
        }

        .classic-input:hover:not(:focus) {
          background: #fff;
          border-color: var(--brand-200);
          box-shadow: 0 2px 6px rgba(37,99,235,0.06);
        }

        .classic-input:focus {
          background: #fff;
          border-color: var(--brand-500);
          box-shadow:
            0 0 0 4px rgba(59,130,246,0.14),
            0 4px 12px rgba(37,99,235,0.08);
        }

        .classic-password-toggle {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          color: var(--ink-400);
          cursor: pointer;
          padding: 7px;
          display: flex;
          align-items: center;
          border-radius: 9px;
          transition: color 0.2s ease, background 0.2s ease;
          z-index: 1;
        }

        .classic-password-toggle:hover {
          color: var(--brand-600);
          background: var(--brand-50);
        }

        /* Options Row */
        .classic-options-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: clamp(14px, 2vh, 20px);
          flex-wrap: wrap;
          gap: 8px;
        }

        .classic-checkbox-label {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          color: var(--ink-700);
          cursor: pointer;
          user-select: none;
          position: relative;
          font-weight: 500;
          letter-spacing: 0.005em;
        }

        .classic-checkbox {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .classic-checkmark {
          width: 18px;
          height: 18px;
          border: 1.5px solid var(--ink-300);
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          background: #fff;
          flex-shrink: 0;
        }

        .classic-checkbox-label:hover .classic-checkmark {
          border-color: var(--brand-400);
        }

        .classic-checkbox:checked + .classic-checkmark {
          background: var(--brand-600);
          border-color: var(--brand-600);
          box-shadow: 0 2px 6px rgba(37,99,235,0.32);
        }

        .classic-checkbox:checked + .classic-checkmark::after {
          content: '';
          width: 4px;
          height: 8px;
          border: solid #fff;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
          margin-top: -1px;
        }

        .classic-forgot-link {
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 600;
          color: var(--brand-600);
          cursor: pointer;
          padding: 0;
          font-family: inherit;
          transition: color 0.2s ease;
          letter-spacing: 0.005em;
        }

        .classic-forgot-link:hover {
          color: var(--brand-800);
          text-decoration: underline;
        }

        /* Submit Button */
        .classic-submit-btn {
          width: 100%;
          height: clamp(46px, 6vh, 52px);
          background: linear-gradient(135deg, var(--brand-700) 0%, var(--brand-500) 100%);
          background-size: 200% 200%;
          background-position: 0% 50%;
          color: #fff;
          border: none;
          border-radius: 13px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Manrope', 'Inter', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          transition:
            background-position 0.5s ease,
            box-shadow 0.35s ease,
            transform 0.2s ease;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.22) inset,
            0 10px 22px rgba(37,99,235,0.34),
            0 2px 6px rgba(37,99,235,0.22);
          position: relative;
          overflow: hidden;
          letter-spacing: 0.01em;
        }

        .classic-submit-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg,
            transparent 0%,
            transparent 35%,
            rgba(255,255,255,0.22) 50%,
            transparent 65%,
            transparent 100%);
          transform: translateX(-100%);
          transition: transform 0.7s ease;
        }

        .classic-submit-btn:hover:not(:disabled) {
          background-position: 100% 50%;
          box-shadow:
            0 1px 0 rgba(255,255,255,0.22) inset,
            0 14px 32px rgba(37,99,235,0.44),
            0 4px 10px rgba(37,99,235,0.26);
          transform: translateY(-1px);
        }

        .classic-submit-btn:hover:not(:disabled)::before {
          transform: translateX(100%);
        }

        .classic-submit-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }

        .classic-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .classic-spinner { animation: classicSpin 0.8s linear infinite; }

        @keyframes classicSpin { to { transform: rotate(360deg); } }

        /* Register Link */
        .classic-register-text {
          text-align: center;
          font-size: 13.5px;
          color: var(--ink-500);
          margin: clamp(14px, 2vh, 18px) 0 clamp(10px, 1.4vh, 14px);
          font-weight: 500;
          letter-spacing: 0.005em;
        }

        .classic-register-link {
          background: none;
          border: none;
          font-weight: 700;
          color: var(--brand-600);
          cursor: pointer;
          padding: 0;
          font-family: inherit;
          font-size: 13.5px;
          transition: color 0.2s ease;
          letter-spacing: 0.005em;
        }

        .classic-register-link:hover {
          color: var(--brand-800);
          text-decoration: underline;
        }

        /* Switch Roles Links */
        .classic-switch-roles {
          margin-top: clamp(16px, 2.5vh, 24px);
          padding-top: clamp(14px, 2vh, 20px);
          border-top: 1px dashed rgba(226, 232, 240, 0.9);
          text-align: center;
        }
        .classic-switch-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: var(--ink-400);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
        }
        .classic-switch-links {
          display: flex;
          justify-content: center;
          gap: 12px;
        }
        .classic-switch-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(248, 250, 252, 0.85);
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-700);
          cursor: pointer;
          transition: all 0.25s ease;
          font-family: inherit;
        }
        .classic-switch-link:hover {
          background: #fff;
          border-color: var(--brand-400);
          color: var(--brand-700);
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(37,99,235,0.06);
        }

        /* Footer */
        .classic-footer {
          text-align: center;
          font-size: 11.5px;
          color: var(--ink-400);
          font-weight: 500;
          margin: 0;
          flex-shrink: 0;
          letter-spacing: 0.01em;
        }

        /* RESPONSIVE BREAKPOINTS */
        @media (max-width: 1100px) {
          .login-visual-panel { flex: 1.1 1 0; }
          .ai-feature-card {
            min-width: 160px;
            max-width: 200px;
            padding: 9px 12px 9px 9px;
            gap: 9px;
          }
          .ai-feature-icon { width: 30px; height: 30px; border-radius: 9px; }
          .ai-feature-title { font-size: 12px; }
          .ai-feature-sub { font-size: 10.5px; }
          .ai-bubble { max-width: 200px; }
          .ai-bubble-text { font-size: 12px; }
        }

        @media (max-width: 900px) {
          .login-visual-panel { display: none; }
          .login-form-panel {
            flex: 1 1 100%;
            background:
              radial-gradient(ellipse at 50% 0%, rgba(219,234,254,0.55) 0%, transparent 55%),
              radial-gradient(ellipse at 50% 100%, rgba(191,219,254,0.4) 0%, transparent 60%),
              linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%);
          }
        }

        @media (max-width: 480px) {
          .login-form-panel { padding: 14px; }
          .classic-login-container { max-width: 100%; }
          .classic-card-body { padding: 22px 20px 20px; }
        }

        /* Very short viewports */
        @media (max-height: 680px) {
          .classic-register-text { display: none; }
        }

        @media (max-height: 480px) {
          .classic-footer { display: none; }
          .classic-card-body { padding: 16px 18px; }
          .classic-field { margin-bottom: 8px; }
        }

        /* Reduce motion */
        @media (prefers-reduced-motion: reduce) {
          .visual-glow-1, .visual-glow-2, .visual-float-dot,
          .robot-hotspot-pulse { animation: none; }
          .classic-login-card,
          .classic-input,
          .classic-submit-btn,
          .robot-hotspot-ring { transition: none; }
        }

        /* Fix autofill styles */
        .classic-input:-webkit-autofill,
        .classic-input:-webkit-autofill:hover,
        .classic-input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--ink-900) !important;
          -webkit-box-shadow: 0 0 0 30px rgba(248,250,252,0.95) inset !important;
          caret-color: var(--ink-900);
          transition: background-color 5000s ease-in-out 0s;
        }

        .classic-input:focus:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 30px #fff inset !important;
        }
      `}</style>
    </div>
  )
}

export default ParticipantLogin
