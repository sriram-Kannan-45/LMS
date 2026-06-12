import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Eye, EyeOff, Mail, Lock, Shield, GraduationCap,
  CheckCircle2, AlertCircle, ArrowRight, Loader2
} from 'lucide-react'
import { useToast } from '../components/Toast'
import { API } from '../api/api'
import blueVideo from '../assets/blue.mp4'

function ParticipantLogin({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '', role: 'PARTICIPANT' })
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

    localStorage.setItem('lastRole', 'PARTICIPANT')

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
        if (res.status === 403 && data.error?.includes('pending')) throw new Error('Your account is pending approval')
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

      navTimeoutRef.current = setTimeout(() => {
        navigate('/participant')
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
        poster={blueVideo}
      >
        <source src={blueVideo} type="video/mp4" />
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
              <rect width="32" height="32" rx="8" fill="url(#participantLogoGrad)" />
              <path d="M7 16C9.5 16 11 11 13 11C15 11 16.5 21 18.5 21C20.5 21 22 16 25 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="participantLogoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563eb" />
                  <stop offset="1" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
            </svg>
            <span>WaveInit</span>
          </div>

          <div className="trainer-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your Participant Portal</p>
          </div>

          {error && (
            <div className="trainer-alert trainer-alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="trainer-alert trainer-alert-success">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="trainer-field">
              <label className="trainer-label" htmlFor="participant-email">Username or Email</label>
              <div className="trainer-input-wrap">
                <Mail size={16} className="trainer-input-icon" />
                <input
                  id="participant-email"
                  type="text"
                  className="trainer-input"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="participant_username"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="trainer-field">
              <label className="trainer-label" htmlFor="participant-password">Password</label>
              <div className="trainer-input-wrap">
                <Lock size={16} className="trainer-input-icon" />
                <input
                  id="participant-password"
                  type={showPassword ? 'text' : 'password'}
                  className="trainer-input"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="trainer-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="trainer-options-row">
              <label className="trainer-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="trainer-checkbox"
                />
                <span className="trainer-checkmark" />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="trainer-forgot-link"
              >
                Forgot password?
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="trainer-submit-btn trainer-submit-btn--blue"
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.99 }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="trainer-spinner" />
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

          <p className="trainer-footer" style={{ marginTop: 12 }}>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#2563eb',
                cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                padding: 0
              }}
            >
              Create Account
            </button>
          </p>

          <div className="trainer-switch-section">
            <span className="trainer-switch-label">Switch Portal</span>
            <div className="trainer-switch-row">
              <button
                type="button"
                onClick={() => navigate('/trainer')}
                className="trainer-switch-btn"
              >
                <GraduationCap size={14} />
                <span>Trainer Hub</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="trainer-switch-btn"
              >
                <Shield size={14} />
                <span>Admin Portal</span>
              </button>
            </div>
          </div>

        </motion.div>

        <p className="trainer-footer">© 2026 · WaveInit LMS · Learning Space</p>
      </div>
    </div>
  )
}

export default ParticipantLogin
