import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Mail, Phone, Lock, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { API } from '../api/api'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 }
}

function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  
  const navigate = useNavigate()
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await fetch(API.REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      
      setSuccess('✓ Registration successful! Your account is pending admin approval.')
      setForm({ name: '', email: '', password: '', phone: '' })
      
      setTimeout(() => {
        navigate('/login', { state: { message: 'Your account is pending admin approval. You will be notified by email once approved!' } })
      }, 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div 
      variants={pageVariants} 
      initial="initial" 
      animate="animate" 
      exit="exit"
      className="classic-login-page"
    >
      {/* Decorative Orbs */}
      <div className="classic-orb orb-1" />
      <div className="classic-orb orb-2" />

      <div className="classic-card">
        {/* Top Accent Accent Bar */}
        <div className="classic-accent-bar" />

        <div className="classic-card-body">
          {/* Header & Logo */}
          <div className="classic-login-header">
            <div className="classic-logo-wrapper">
              <div className="classic-logo-icon">W</div>
            </div>
            <h1 className="classic-title">WAVE INIT</h1>
            <p className="classic-subtitle">Create Participant Account</p>
          </div>

          {/* Feedback alerts */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="classic-alert classic-alert-danger"
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="classic-alert classic-alert-success"
              >
                <CheckCircle2 size={16} />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {!success ? (
            <form onSubmit={handleSubmit} className="classic-form">
              {/* Name Field */}
              <div className="classic-field-group">
                <label htmlFor="reg-name" className="classic-label">Full Name</label>
                <div className={`classic-input-wrapper ${focusedField === 'name' ? 'focused' : ''}`}>
                  <User size={18} className="classic-input-icon" />
                  <input
                    id="reg-name"
                    type="text"
                    className="classic-input"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="John Doe"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="classic-field-group">
                <label htmlFor="reg-email" className="classic-label">Email Address</label>
                <div className={`classic-input-wrapper ${focusedField === 'email' ? 'focused' : ''}`}>
                  <Mail size={18} className="classic-input-icon" />
                  <input
                    id="reg-email"
                    type="email"
                    className="classic-input"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="john@example.com"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Phone Field */}
              <div className="classic-field-group">
                <label htmlFor="reg-phone" className="classic-label">Phone Number</label>
                <div className={`classic-input-wrapper ${focusedField === 'phone' ? 'focused' : ''}`}>
                  <Phone size={18} className="classic-input-icon" />
                  <input
                    id="reg-phone"
                    type="tel"
                    className="classic-input"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="e.g., 9876543210"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="classic-field-group">
                <label htmlFor="reg-password" className="classic-label">Password</label>
                <div className={`classic-input-wrapper ${focusedField === 'password' ? 'focused' : ''}`}>
                  <Lock size={18} className="classic-input-icon" />
                  <input
                    id="reg-password"
                    type="password"
                    className="classic-input"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                id="reg-submit"
                type="submit"
                className="classic-btn"
                disabled={loading}
                style={{ marginTop: '8px' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="classic-spinner" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                Redirecting to login...
              </p>
            </div>
          )}

          {/* Log in Redirect */}
          <div className="classic-register-text" style={{ marginTop: '24px', marginBottom: 0 }}>
            Already registered?{' '}
            <button
              type="button"
              className="classic-register-link"
              onClick={() => navigate('/login')}
              disabled={loading}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Classic Login Page CSS to keep fully self-contained */}
      <style>{`
        .classic-login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f0f2f5;
          padding: 24px;
          font-family: 'Poppins', -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* ── Decorative Orbs ── */
        .classic-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(130px);
          opacity: 0.45;
          z-index: 0;
          pointer-events: none;
        }

        .orb-1 {
          width: 400px;
          height: 400px;
          background: #818cf8;
          top: -10%;
          left: -10%;
        }

        .orb-2 {
          width: 350px;
          height: 350px;
          background: #c084fc;
          bottom: -5%;
          right: -5%;
        }

        /* ── Card ── */
        .classic-card {
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05),
                      0 20px 48px -10px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(226, 232, 240, 0.8);
          position: relative;
          z-index: 10;
          overflow: hidden;
        }

        .classic-accent-bar {
          height: 5px;
          background: linear-gradient(90deg, #6366f1, #a855f7);
          width: 100%;
        }

        .classic-card-body {
          padding: 40px 36px 32px;
        }

        /* ── Header ── */
        .classic-login-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .classic-logo-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }

        .classic-logo-icon {
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 10px;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 800;
          font-family: 'Poppins', sans-serif;
          box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);
        }

        .classic-title {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.03em;
          margin: 0 0 4px;
          font-family: 'Poppins', sans-serif;
        }

        .classic-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
          font-weight: 450;
        }

        /* ── Alerts ── */
        .classic-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.4;
          margin-bottom: 20px;
          border: 1px solid transparent;
        }

        .classic-alert-danger {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fca5a5;
        }

        .classic-alert-success {
          background: #f0fdf4;
          color: #15803d;
          border-color: #86efac;
        }

        /* ── Form ── */
        .classic-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .classic-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .classic-label {
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          text-align: left;
        }

        .classic-input-wrapper {
          display: flex;
          align-items: center;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 14px;
          transition: all 0.2s ease;
          position: relative;
        }

        .classic-input-wrapper.focused {
          background: #ffffff;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .classic-input-icon {
          color: #94a3b8;
          flex-shrink: 0;
        }

        .classic-input {
          flex: 1;
          height: 42px;
          border: none;
          background: transparent;
          font-size: 14px;
          color: #0f172a;
          padding: 0 0 0 10px;
          outline: none;
          width: 100%;
          font-family: inherit;
        }

        .classic-input::placeholder {
          color: #94a3b8;
        }

        /* ── Button ── */
        .classic-btn {
          height: 44px;
          background: linear-gradient(135deg, #6366f1, #7c3aed);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
          width: 100%;
          font-family: inherit;
        }

        .classic-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
          background: linear-gradient(135deg, #5558e6, #6d2ed4);
        }

        .classic-btn:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
        }

        .classic-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .classic-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* ── Register Link ── */
        .classic-register-text {
          text-align: center;
          font-size: 14px;
          color: #64748b;
        }

        .classic-register-link {
          background: none;
          border: none;
          font-weight: 600;
          color: #6366f1;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
          font-size: 14px;
          transition: color 0.2s ease;
        }

        .classic-register-link:hover {
          color: #4f46e5;
          text-decoration: underline;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .classic-login-page {
            padding: 16px;
          }

          .classic-card-body {
            padding: 32px 20px 24px;
          }
        }
      `}</style>
    </motion.div>
  )
}

export default Register