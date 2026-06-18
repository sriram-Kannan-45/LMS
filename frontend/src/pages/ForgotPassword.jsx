import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ShieldCheck, KeyRound, RefreshCw } from 'lucide-react'
import { API } from '../api/api'

/* ── password strength ── */
function getStrength(pw) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s // 0-4
}
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

/* ── OTP digit input ── */
function OtpInput({ value, onChange }) {
  const refs = useRef([])
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const next = digits.map((d, idx) => idx === i ? '' : d)
      onChange(next.join(''))
      if (i > 0) refs.current[i - 1]?.focus()
    }
  }

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    const next = digits.map((d, idx) => idx === i ? char : d)
    onChange(next.join(''))
    if (char && i < 5) refs.current[i + 1]?.focus()
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, '').slice(0, 6))
    refs.current[Math.min(pasted.length, 5)]?.focus()
    e.preventDefault()
  }

  return (
    <div className="fp-otp-row">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          className={`fp-otp-box ${d ? 'filled' : ''}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  )
}

/* ── step slide animation ── */
const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.22, ease: 'easeIn' } }
}

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)   // 1=email, 2=otp, 3=new-password, 4=success

  // step 1
  const [email, setEmail] = useState('')
  // step 2
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [resetToken, setResetToken] = useState('')
  // step 3
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showCf, setShowCf] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  // Prevents duplicate API calls across React re-renders / double-clicks / Enter spam
  const inFlight = useRef(false)

  // countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Persist cooldown across page refreshes — keyed by email so different users don't collide
  useEffect(() => {
    if (!email) return
    const key = `fp_cooldown_${email}`
    if (countdown > 0) {
      localStorage.setItem(key, String(Date.now() + countdown * 1000))
    } else {
      localStorage.removeItem(key)
    }
  }, [countdown, email])

  // Restore cooldown when entering OTP step (e.g. after refresh)
  useEffect(() => {
    if (step !== 2 || !email) return
    const key = `fp_cooldown_${email}`
    const until = parseInt(localStorage.getItem(key) || '0', 10)
    const remaining = Math.max(0, Math.round((until - Date.now()) / 1000))
    if (remaining > 0 && countdown === 0) setCountdown(remaining)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, email])

  const post = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  /* step 1 → send OTP */
  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (inFlight.current) return
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError('Enter a valid email address')
    }
    inFlight.current = true
    setLoading(true)
    try {
      await post(API.FORGOT_PASSWORD.SEND_OTP, { email })
      setCountdown(60)
      setInfo("OTP sent! Check your inbox (and spam folder).")
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  /* step 2 → verify OTP */
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (inFlight.current) return
    setError('')
    if (otp.replace(/\D/g, '').length < 6) return setError('Enter the 6-digit OTP')
    inFlight.current = true
    setLoading(true)
    try {
      const data = await post(API.FORGOT_PASSWORD.VERIFY_OTP, { email, otp })
      setResetToken(data.resetToken)
      setInfo('')
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  /* step 2 → resend OTP */
  const handleResend = async () => {
    if (countdown > 0 || inFlight.current) return
    setError('')
    setOtp('')
    inFlight.current = true
    setLoading(true)
    try {
      await post(API.FORGOT_PASSWORD.SEND_OTP, { email })
      setCountdown(60)
      setInfo('New OTP sent. Check your inbox or spam folder.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  /* step 3 → reset password */
  const handleReset = async (e) => {
    e.preventDefault()
    if (inFlight.current) return
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters')
    if (password !== confirm) return setError('Passwords do not match')
    inFlight.current = true
    setLoading(true)
    try {
      await post(API.FORGOT_PASSWORD.RESET, { email, resetToken, newPassword: password })
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  const strength = getStrength(password)

  return (
    <div className="fp-page">
      <div className="fp-card">
        {/* back button */}
        {step < 4 && (
          <button className="fp-back" onClick={() => step === 1 ? navigate('/login') : setStep(s => s - 1)}>
            <ArrowLeft size={16} />
            <span>{step === 1 ? 'Back to Login' : 'Back'}</span>
          </button>
        )}

        {/* step indicator */}
        {step < 4 && (
          <div className="fp-steps">
            {[1, 2, 3].map(s => (
              <div key={s} className={`fp-step-dot ${step >= s ? 'active' : ''} ${step > s ? 'done' : ''}`} />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── STEP 1: Email ── */}
          {step === 1 && (
            <motion.div key="s1" variants={stepVariants} initial="enter" animate="center" exit="exit">
              <div className="fp-icon-wrap blue">
                <Mail size={24} />
              </div>
              <h2 className="fp-title">Forgot Password?</h2>
              <p className="fp-sub">Enter your registered email and we'll send you a 6-digit OTP.</p>

              {error && <div className="fp-alert error" role="alert" aria-live="assertive"><AlertCircle size={15} />{error}</div>}

              <form onSubmit={handleSendOtp}>
                <label className="fp-label">Email Address</label>
                <div className="fp-input-wrap">
                  <Mail size={17} className="fp-input-icon" />
                  <input
                    className="fp-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <button className="fp-btn" type="submit" disabled={loading}>
                  {loading ? <><Loader2 size={17} className="fp-spin" />Sending OTP…</> : 'Send OTP'}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 2 && (
            <motion.div key="s2" variants={stepVariants} initial="enter" animate="center" exit="exit">
              <div className="fp-icon-wrap blue">
                <ShieldCheck size={24} />
              </div>
              <h2 className="fp-title">Enter OTP</h2>
              <p className="fp-sub">We sent a 6-digit code to <strong>{email}</strong>. It expires in 5 minutes — please also check your <strong>spam / junk</strong> folder.</p>

              {info && <div className="fp-alert info" role="status" aria-live="polite"><CheckCircle2 size={15} />{info}</div>}
              {error && <div className="fp-alert error" role="alert" aria-live="assertive"><AlertCircle size={15} />{error}</div>}

              <form onSubmit={handleVerifyOtp}>
                <OtpInput value={otp} onChange={setOtp} />
                <button className="fp-btn" type="submit" disabled={loading || otp.replace(/\D/g,'').length < 6}>
                  {loading ? <><Loader2 size={17} className="fp-spin" />Verifying…</> : 'Verify OTP'}
                </button>
              </form>

              <button className="fp-resend" onClick={handleResend} disabled={countdown > 0 || loading}>
                <RefreshCw size={14} />
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </button>
            </motion.div>
          )}

          {/* ── STEP 3: New Password ── */}
          {step === 3 && (
            <motion.div key="s3" variants={stepVariants} initial="enter" animate="center" exit="exit">
              <div className="fp-icon-wrap blue">
                <KeyRound size={24} />
              </div>
              <h2 className="fp-title">New Password</h2>
              <p className="fp-sub">Choose a strong password with at least 8 characters.</p>

              {error && <div className="fp-alert error" role="alert" aria-live="assertive"><AlertCircle size={15} />{error}</div>}

              <form onSubmit={handleReset}>
                <label className="fp-label">New Password</label>
                <div className="fp-input-wrap">
                  <KeyRound size={17} className="fp-input-icon" />
                  <input
                    className="fp-input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="fp-eye" onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {/* strength bar */}
                {password.length > 0 && (
                  <div className="fp-strength">
                    <div className="fp-strength-bars">
                      {[1,2,3,4].map(n => (
                        <div key={n} className="fp-strength-bar" style={{ background: n <= strength ? STRENGTH_COLOR[strength] : '#e2e8f0' }} />
                      ))}
                    </div>
                    <span style={{ color: STRENGTH_COLOR[strength] }}>{STRENGTH_LABEL[strength]}</span>
                  </div>
                )}

                <label className="fp-label" style={{ marginTop: 14 }}>Confirm Password</label>
                <div className="fp-input-wrap">
                  <KeyRound size={17} className="fp-input-icon" />
                  <input
                    className="fp-input"
                    type={showCf ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                  />
                  <button type="button" className="fp-eye" onClick={() => setShowCf(v => !v)}>
                    {showCf ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {confirm.length > 0 && password !== confirm && (
                  <p className="fp-mismatch">Passwords do not match</p>
                )}

                <button className="fp-btn" type="submit" disabled={loading || password.length < 8 || password !== confirm}>
                  {loading ? <><Loader2 size={17} className="fp-spin" />Resetting…</> : 'Reset Password'}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── STEP 4: Success ── */}
          {step === 4 && (
            <motion.div key="s4" variants={stepVariants} initial="enter" animate="center" exit="exit" className="fp-success">
              <motion.div
                className="fp-icon-wrap green"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
              >
                <CheckCircle2 size={28} />
              </motion.div>
              <h2 className="fp-title">Password Reset!</h2>
              <p className="fp-sub">Your password has been updated successfully. You can now sign in.</p>
              <button className="fp-btn" onClick={() => navigate('/login', { state: { message: 'Password reset successfully. Please sign in.' } })}>
                Go to Login
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .fp-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #eff6ff 0%, #eef4ff 50%, #f8faff 100%);
          padding: 24px;
          font-family: 'Poppins', 'Poppins', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .fp-card {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.95);
          border-radius: 24px;
          box-shadow: 0 1px 0 rgba(255,255,255,0.95) inset, 0 16px 48px rgba(37,99,235,0.12), 0 4px 12px rgba(15,23,42,0.06);
          padding: 36px 40px 40px;
          width: 100%;
          max-width: 420px;
          position: relative;
        }

        .fp-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: #2563eb;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          margin-bottom: 20px;
          font-family: inherit;
          transition: color 0.2s;
        }
        .fp-back:hover { color: #1d4ed8; }

        .fp-steps {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }
        .fp-step-dot {
          height: 4px;
          flex: 1;
          border-radius: 99px;
          background: #e2e8f0;
          transition: background 0.3s;
        }
        .fp-step-dot.active { background: #93c5fd; }
        .fp-step-dot.done   { background: #2563eb; }

        .fp-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .fp-icon-wrap.blue { background: linear-gradient(135deg,#1d4ed8,#3b82f6); color:#fff; box-shadow: 0 6px 18px rgba(37,99,235,0.32); }
        .fp-icon-wrap.green { background: linear-gradient(135deg,#16a34a,#22c55e); color:#fff; box-shadow: 0 6px 18px rgba(34,197,94,0.32); }

        .fp-title {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 6px;
          letter-spacing: -0.03em;
        }
        .fp-sub {
          font-size: 13.5px;
          color: #64748b;
          margin: 0 0 22px;
          line-height: 1.55;
          font-weight: 500;
        }

        .fp-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 16px;
        }
        .fp-alert.error { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; }
        .fp-alert.info  { background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; }

        .fp-label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 7px;
          letter-spacing: 0.01em;
        }

        .fp-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }
        .fp-input-icon {
          position: absolute;
          left: 13px;
          color: #94a3b8;
          pointer-events: none;
        }
        .fp-input {
          width: 100%;
          height: 48px;
          padding: 0 42px 0 42px;
          background: rgba(248,250,252,0.9);
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #0f172a;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .fp-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.14);
          background: #fff;
        }
        .fp-eye {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          border-radius: 8px;
          transition: color 0.2s;
        }
        .fp-eye:hover { color: #2563eb; }

        .fp-btn {
          width: 100%;
          height: 50px;
          background: linear-gradient(135deg,#1d4ed8,#3b82f6);
          color: #fff;
          border: none;
          border-radius: 13px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
          box-shadow: 0 8px 20px rgba(37,99,235,0.32);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .fp-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(37,99,235,0.4); }
        .fp-btn:active:not(:disabled) { transform: translateY(0); }
        .fp-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .fp-spin { animation: fpSpin 0.8s linear infinite; }
        @keyframes fpSpin { to { transform: rotate(360deg); } }

        /* OTP boxes */
        .fp-otp-row {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-bottom: 20px;
        }
        .fp-otp-box {
          width: 48px;
          height: 56px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          background: rgba(248,250,252,0.9);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit;
        }
        .fp-otp-box:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.14);
          background: #fff;
        }
        .fp-otp-box.filled { border-color: #2563eb; background: #eff6ff; }

        /* resend */
        .fp-resend {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 600;
          color: #2563eb;
          cursor: pointer;
          padding: 10px 0 0;
          font-family: inherit;
          transition: color 0.2s;
        }
        .fp-resend:disabled { color: #94a3b8; cursor: default; }
        .fp-resend:not(:disabled):hover { color: #1d4ed8; }

        /* strength */
        .fp-strength {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: -8px 0 14px;
        }
        .fp-strength-bars { display: flex; gap: 4px; flex: 1; }
        .fp-strength-bar { height: 4px; flex: 1; border-radius: 99px; transition: background 0.3s; }
        .fp-strength span { font-size: 12px; font-weight: 600; min-width: 44px; }

        .fp-mismatch { font-size: 12px; color: #dc2626; margin: -10px 0 12px; font-weight: 500; }

        /* success */
        .fp-success { text-align: center; }
        .fp-success .fp-icon-wrap { margin: 0 auto 16px; }
        .fp-success .fp-sub { margin-bottom: 28px; }

        @media (max-width: 480px) {
          .fp-card { padding: 28px 22px 32px; }
          .fp-otp-box { width: 42px; height: 50px; font-size: 20px; }
        }
      `}</style>
    </div>
  )
}
