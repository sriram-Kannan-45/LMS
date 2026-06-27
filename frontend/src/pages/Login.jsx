import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Eye, EyeOff, Mail, Lock,
  CheckCircle2, AlertCircle, ArrowRight, Loader2,
  User, Shield, GraduationCap
} from 'lucide-react'
import { useToast } from '../components/Toast'
import { API } from '../api/api'
import greenVideo from '../assets/green.mp4'
import blueVideo from '../assets/blue.mp4'
import redVideo from '../assets/red.mp4'

const roles = [
  { 
    key: 'PARTICIPANT', 
    label: 'Participant', 
    color: '#2563EB', 
    activeClass: 'trainer-submit-btn--blue',
    subtitle: 'Sign in to your Participant Portal',
    video: blueVideo,
    placeholder: 'participant_username'
  },
  { 
    key: 'TRAINER', 
    label: 'Trainer', 
    color: '#16A34A', 
    activeClass: 'trainer-submit-btn--green',
    subtitle: 'Sign in to your Trainer Hub',
    video: greenVideo,
    placeholder: 'trainer_username'
  },
  { 
    key: 'ADMIN', 
    label: 'Admin', 
    color: '#DC2626', 
    activeClass: 'trainer-submit-btn--red',
    subtitle: 'Sign in to your Admin Portal',
    video: redVideo,
    placeholder: 'admin_username'
  }
]

export default function LoginPage({ onLogin, defaultRole }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { success: showSuccess, error: showError } = useToast()

  const [form, setForm] = useState(() => {
    const lastRole = localStorage.getItem('lastRole') || 'PARTICIPANT'
    const stateRole = location.state?.fromRole
    return {
      email: '',
      password: '',
      role: defaultRole || stateRole || lastRole
    }
  })

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // If already logged in, redirect to respective hub
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser)
      if (parsed?.role === 'ADMIN') return <Navigate to="/admin" replace />
      if (parsed?.role === 'TRAINER') return <Navigate to="/trainer" replace />
      if (parsed?.role === 'PARTICIPANT') return <Navigate to="/participant" replace />
    } catch {
      localStorage.removeItem('user')
    }
  }

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlHeight = document.documentElement.style.height
    const prevBodyHeight = document.body.style.height
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'

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
    if (defaultRole) {
      setForm(p => ({ ...p, role: defaultRole }))
    } else if (location.state?.fromRole) {
      setForm(p => ({ ...p, role: location.state.fromRole }))
    }
  }, [defaultRole, location.state?.fromRole])

  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message)
      showSuccess(location.state.message)
      setTimeout(() => setSuccess(''), 3000)
    }
  }, [location.state, showSuccess])

  const activeRoleConfig = roles.find(r => r.key === form.role) || roles[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email) {
      setError('Username or Email is required')
      showError('Username or Email is required')
      return
    }
    if (!form.password) {
      setError('Password is required')
      showError('Password is required')
      return
    }

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
      localStorage.setItem('lastRole', form.role)
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true')
        localStorage.setItem('rememberedEmail', form.email)
      } else {
        localStorage.removeItem('rememberMe')
        localStorage.removeItem('rememberedEmail')
      }

      setSuccess(`Welcome back! Redirecting...`)
      showSuccess(`Welcome back, ${data.name || 'user'}!`)
      onLogin(data)

      setTimeout(() => {
        if (form.role === 'ADMIN') navigate('/admin')
        else if (form.role === 'TRAINER') navigate('/trainer')
        else navigate('/participant')
      }, 500)
    } catch (err) {
      const msg = err.message === 'Failed to fetch' ? 'Cannot connect to server.' : err.message
      setError(msg)
      showError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="trainer-video-login">
      <video
        key={form.role}
        className="trainer-video-bg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src={activeRoleConfig.video} type="video/mp4" />
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
              <rect width="32" height="32" rx="8" fill="url(#loginLogoGrad)" />
              <path d="M7 16C9.5 16 11 11 13 11C15 11 16.5 21 18.5 21C20.5 21 22 16 25 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="loginLogoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor={form.role === 'PARTICIPANT' ? '#3b82f6' : form.role === 'TRAINER' ? '#22c55e' : '#ef4444'} />
                  <stop offset="1" stopColor={form.role === 'PARTICIPANT' ? '#2563eb' : form.role === 'TRAINER' ? '#16a34a' : '#dc2626'} />
                </linearGradient>
              </defs>
            </svg>
            <span>WaveInit</span>
          </div>

          <div className="trainer-card-header">
            <h2>Welcome back</h2>
            <p>{activeRoleConfig.subtitle}</p>
          </div>

          {/* Unified role tab selector */}
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.06)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '20px',
            border: '1px solid rgba(15, 23, 42, 0.03)'
          }}>
            {roles.map(r => {
              const active = form.role === r.key
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    setForm(p => ({ ...p, role: r.key }))
                    localStorage.setItem('lastRole', r.key)
                    setError('')
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: active ? '#fff' : 'transparent',
                    color: active ? r.color : '#64748b',
                    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    fontFamily: 'Poppins, sans-serif'
                  }}
                >
                  {r.label}
                </button>
              )
            })}
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
              <label className="trainer-label" htmlFor="login-email">Username or Email</label>
              <div className="trainer-input-wrap">
                <Mail size={16} className="trainer-input-icon" />
                <input
                  id="login-email"
                  type="text"
                  className="trainer-input"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder={activeRoleConfig.placeholder}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="trainer-field">
              <label className="trainer-label" htmlFor="login-password">Password</label>
              <div className="trainer-input-wrap">
                <Lock size={16} className="trainer-input-icon" />
                <input
                  id="login-password"
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
              className={`trainer-submit-btn ${activeRoleConfig.activeClass}`}
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
                  <span>Sign In as {activeRoleConfig.label}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>

          {form.role === 'PARTICIPANT' && (
            <p className="trainer-switch-label" style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                  padding: 0
                }}
              >
                Create Account
              </button>
            </p>
          )}

        </motion.div>

        <p className="trainer-footer">© {new Date().getFullYear()} · WaveInit LMS</p>
      </div>
    </div>
  )
}
