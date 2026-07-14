import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Clock, MessageSquare, X, Star } from 'lucide-react'
import { useState } from 'react'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function StarPicker({ value, onChange, ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => {
        const active = s <= value
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(s)}
            className="ac-focus-ring"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: active ? '#f59e0b' : 'var(--academic-border-strong)',
              transition: 'transform 150ms ease, color 150ms ease',
            }}
          >
            <Star size={26} fill={active ? '#f59e0b' : 'transparent'} strokeWidth={1.6} />
          </button>
        )
      })}
    </div>
  )
}

export default function FeedbackSection({
  enrollments = [],
  feedbacks = [],
  loading = false,
  onSubmit,           // ({ enrollment, fbForm, surveyAnswers }) => Promise<void>
  fetchQuestions,     // (trainingId) => Promise<questions[]>
}) {
  const [modal, setModal] = useState(null)         // enrollment object
  const [questions, setQuestions] = useState([])
  const [fbForm, setFbForm] = useState({ trainerRating: 0, subjectRating: 0, comments: '', anonymous: false })
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const hasFeedback = (id) => feedbacks.some((f) => f.trainingId === id)

  const openModal = async (enrollment) => {
    setModal(enrollment)
    setFbForm({ trainerRating: 0, subjectRating: 0, comments: '', anonymous: false })
    setAnswers({})
    if (fetchQuestions) {
      const qs = await fetchQuestions(enrollment.trainingId)
      setQuestions(qs || [])
    }
  }
  const closeModal = () => { setModal(null); setQuestions([]) }

  const submit = async (e) => {
    e.preventDefault()
    if (!fbForm.trainerRating || !fbForm.subjectRating) return
    setSubmitting(true)
    try {
      const surveyAnswers = Object.entries(answers).map(([qid, val]) => {
        const q = questions.find((x) => x.id === parseInt(qid))
        return {
          questionId: parseInt(qid),
          answerText: q?.questionType !== 'RATING' ? val : null,
          answerRating: q?.questionType === 'RATING' ? parseInt(val) : null,
        }
      })
      await onSubmit?.({ enrollment: modal, fbForm, surveyAnswers })
      closeModal()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ac-stack">
      <div>
        <h2 className="ac-section-title">Share Course Feedback</h2>
        <p className="ac-section-subtitle">Rate your experience to help instructors improve</p>
      </div>

      {!loading && enrollments.length === 0 && (
        <div className="ac-empty">
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'var(--academic-accent-50)', color: 'var(--academic-accent-500)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No courses to review</h3>
          <p style={{ fontSize: 14, color: 'var(--academic-text-muted)' }}>
            Join a course first; you can review it once it has started.
          </p>
        </div>
      )}

      {enrollments.length > 0 && (
        <div className="ac-card" style={{ padding: 0, overflow: 'hidden' }}>
          {enrollments.map((e, i) => {
            const started = new Date() >= new Date(e.startDate)
            const submitted = hasFeedback(e.trainingId)
            return (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3"
                style={{
                  padding: '14px 18px',
                  borderBottom: i < enrollments.length - 1 ? '1px solid var(--academic-border-soft)' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 14,
                    color: 'var(--academic-text)', marginBottom: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {e.trainingTitle}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--academic-text-muted)' }}>
                    {e.trainerName || 'TBA'} · started {fmtDate(e.startDate)}
                  </div>
                </div>
                {submitted ? (
                  <span className="ac-chip ac-chip-success"><CheckCircle size={11} /> Submitted</span>
                ) : !started ? (
                  <span className="ac-chip"><Clock size={11} /> Not started</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openModal(e)}
                    className="ac-btn ac-btn-secondary ac-btn-sm ac-focus-ring"
                  >
                    <MessageSquare size={12} /> Give feedback
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Feedback modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeModal}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
              backdropFilter: 'blur(4px)', zIndex: 1100,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <motion.form
              onSubmit={submit}
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.96, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 12, opacity: 0 }}
              style={{
                background: 'var(--academic-surface)', borderRadius: 'var(--academic-radius-lg)',
                width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto',
                boxShadow: 'var(--academic-shadow-pop)',
              }}
            >
              <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid var(--academic-border-soft)' }}>
                <div>
                  <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 700 }}>Course feedback</h3>
                  <p style={{ fontSize: 13, color: 'var(--academic-text-muted)' }}>{modal.trainingTitle}</p>
                </div>
                <button type="button" onClick={closeModal} className="ac-btn ac-btn-ghost ac-focus-ring" aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--academic-text-muted)' }}>
                    Instructor rating
                  </label>
                  <StarPicker value={fbForm.trainerRating} onChange={(v) => setFbForm((p) => ({ ...p, trainerRating: v }))} ariaLabel="Instructor rating" />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--academic-text-muted)' }}>
                    Subject rating
                  </label>
                  <StarPicker value={fbForm.subjectRating} onChange={(v) => setFbForm((p) => ({ ...p, subjectRating: v }))} ariaLabel="Subject rating" />
                </div>
                <div>
                  <label htmlFor="fb-comments" style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--academic-text-muted)', marginBottom: 6, display: 'block' }}>
                    Comments (optional)
                  </label>
                  <textarea
                    id="fb-comments"
                    rows={3}
                    placeholder="What did you enjoy? Anything to improve?"
                    value={fbForm.comments}
                    onChange={(e) => setFbForm((p) => ({ ...p, comments: e.target.value }))}
                    className="ac-input ac-focus"
                  />
                </div>

                {questions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {questions.map((q) => (
                      <div key={q.id}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--academic-text)', marginBottom: 6, display: 'block' }}>
                          {q.questionText}
                        </label>
                        {q.questionType === 'RATING' ? (
                          <StarPicker
                            value={parseInt(answers[q.id]) || 0}
                            onChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))}
                            ariaLabel={q.questionText}
                          />
                        ) : q.questionType === 'MULTIPLE_CHOICE' && q.options ? (
                          <select
                            className="ac-input ac-focus"
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                          >
                            <option value="">Select…</option>
                            {q.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="ac-input ac-focus"
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--academic-text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fbForm.anonymous}
                    onChange={(e) => setFbForm((p) => ({ ...p, anonymous: e.target.checked }))}
                  />
                  Submit anonymously
                </label>
              </div>

              <div className="flex items-center justify-end gap-2" style={{ padding: '14px 24px', borderTop: '1px solid var(--academic-border-soft)' }}>
                <button type="button" className="ac-btn ac-focus-ring" onClick={closeModal}>Cancel</button>
                <button
                  type="submit"
                  disabled={submitting || !fbForm.trainerRating || !fbForm.subjectRating}
                  className="ac-btn ac-btn-primary ac-focus-ring"
                >
                  {submitting ? 'Submitting…' : 'Submit feedback'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
