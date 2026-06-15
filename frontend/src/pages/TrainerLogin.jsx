import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Eye, EyeOff, Mail, Lock,
  CheckCircle2, AlertCircle, ArrowRight, Loader2
} from 'lucide-react'
import { useToast } from '../components/Toast'
import { API } from '../api/api'
import greenVideo from '../assets/green.mp4'

const TRAINER_POSTER = 'data:image/svg+xml;base64,' + btoa(
`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1a0a"/>
      <stop offset="50%" stop-color="#0f2d0f"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`)

function TrainerLogin({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '', role: 'TRAINER' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const navigate = useNavigate()
  const navTimeoutRef = useRef(null)
  const location = useLocation()
  const { success: showSuccess, error: showError } = useToast()

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlHeight = document.documentElement.style.height
    const prevBodyHeight = document.body.style.height
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'

    localStorage.setItem('lastRole', 'TRAINER')

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
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current)
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
        throw new Error(data.error || 'Login failed')
      }

      localStorage.setItem('user', JSON.stringify(data))
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true')
        localStorage.setItem('rememberedEmail', form.email)
      } else {
        localStorage.removeItem('rememberMe')
        localStorage.removeItem('rememberedEmail')
      }

      setSuccess('Welcome! Redirecting to hub...')
      showSuccess('Welcome! Redirecting to hub...')
      onLogin(data)

      navTimeoutRef.current = setTimeout(() => {
        navigate('/trainer')
      }, 500)
    } catch (err) {
      const msg = err.message === 'Failed to fetch' ? 'Cannot connect to server.' : err.message
      setError(msg)
      showError(msg)
    } finally { setLoading(false) }
  }

  return (
    <div className="trainer-video-login">
      <video
        className="trainer-video-bg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={TRAINER_POSTER}
      >
        <source src={greenVideo} type="video/mp4" />
      </video>
      <div className="trainer-video-overlay" />

      <div className="trainer-login-content">
        <motion.div
          className="trainer-login-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="trainer-card-logo">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="url(#trainerLogoGrad)" />
              <path d="M8 20L12 12L16 20L20 12L24 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="1.5" fill="white" />
              <circle cx="20" cy="10" r="1.5" fill="white" />
              <defs>
                <linearGradient id="trainerLogoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#22C55E" />
                  <stop offset="1" stopColor="#16A34A" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <h2 className="trainer-card-title">Trainer Login</h2>
          <p className="trainer-card-subtitle">Sign in to manage your courses</p>

          {error && (
            <motion.div className="trainer-message trainer-message--error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div className="trainer-message trainer-message--success" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="trainer-input-group">
              <label className="trainer-input-label">Email Address or Username</label>
              <div className="trainer-input-wrapper">
                <Mail size={18} className="trainer-input-icon" />
                <input
                  type="text"
                  className="trainer-input"
                  placeholder="trainer@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="trainer-input-group">
              <label className="trainer-input-label">Password</label>
              <div className="trainer-input-wrapper">
                <Lock size={18} className="trainer-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="trainer-input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="trainer-password-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="trainer-options-row">
              <label className="trainer-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span>Remember me</span>
              </label>
            </div>

            <button
              className={`trainer-submit-btn trainer-submit-btn--green${loading ? ' trainer-submit-btn--loading' : ''}`}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={20} className="trainer-spinner" />
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="trainer-card-footer">
            Looking for{' '}
            <a href="/login/admin" onClick={e => { e.preventDefault(); navigate('/login/admin') }}>Admin Login</a>
            {' '}or{' '}
            <a href="/login/participant" onClick={e => { e.preventDefault(); navigate('/login/participant') }}>Participant Login</a>?
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default TrainerLogin
