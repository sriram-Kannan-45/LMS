import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import AIQuizList from '../components/AIQuizList'
import QuizTaking from '../components/QuizTaking'
import { useToast } from '../components/Toast'
import { API_BASE as API } from '../api/api'

// ─── New student components ─────────────────────────────────────────────────
import OverviewSection from '../components/student/overview/OverviewSection'
import AvailableCourses from '../components/student/dashboard/AvailableCourses'
import MyEnrollments from '../components/student/dashboard/MyEnrollments'
import FeedbackSection from '../components/student/dashboard/FeedbackSection'
import MyFeedbacks from '../components/student/dashboard/MyFeedbacks'
import LeaderboardSection from '../components/student/leaderboard/LeaderboardSection'
import AchievementsSection from '../components/student/achievements/AchievementsSection'
import LessonsSection from '../components/student/lessons/LessonsSection'
import ProfileSection from '../components/student/profile/ProfileSection'
import ParticipantCourses from './ParticipantCourses'
import ParticipantCodingList from '../components/coding-assessment/ParticipantCodingList'
import { useContinueLearning } from '../hooks/useContinueLearning'
import { useSocketEvent } from '../hooks/useSocket'

const fadeVariant = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

/**
 * ParticipantDashboard — thin orchestrator for the student LMS.
 * Holds shared data (trainings, enrollments, feedbacks, quizzes) and routes
 * each tab to its dedicated section component.
 *
 * Backend contracts (unchanged): /api/trainings, /api/participant/*, /api/feedback,
 * /api/survey, /api/ai-quiz/*. All existing flows preserved.
 */
function ParticipantDashboard({ user, onLogout, activeTab, onTabChange }) {
  const { success, error: showError } = useToast()
  const tab = activeTab || 'overview'
  const handleTabChange = (next) => onTabChange?.(next)

  const auth = useCallback(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token || ''}` }),
    [user]
  )

  const handleResponse = useCallback(async (res) => {
    if (res.status === 401) {
      onLogout?.()
      throw new Error('Session expired. Please log in again.')
    }
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [onLogout])

  const [trainings, setTrainings] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [participantReport, setParticipantReport] = useState(null)

  const fetchParticipantReport = useCallback(async () => {
    try {
      const r = await fetch(`${API}/reports/participant`, { headers: auth() })
      const d = await handleResponse(r)
      if (d.success) {
        setParticipantReport(d.data)
      }
    } catch (e) {
      console.error('fetchParticipantReport error:', e.message)
    }
  }, [auth, handleResponse])
  const { track } = useContinueLearning()

  // ─── Fetchers ─────────────────────────────────────────────────────────────
  const fetchTrainings = useCallback(async () => {
    try {
      const r = await fetch(`${API}/trainings`, { headers: auth() })
      const d = await handleResponse(r)
      setTrainings(Array.isArray(d) ? d : (d.trainings || []))
    } catch (e) {
      console.error('fetchTrainings error:', e.message)
    }
  }, [auth, handleResponse])

  const fetchEnrollments = useCallback(async () => {
    try {
      const r = await fetch(`${API}/participant/enrollments`, { headers: auth() })
      const d = await handleResponse(r)
      setEnrollments(d.enrollments || [])
    } catch (e) {
      console.error('fetchEnrollments error:', e.message)
    }
  }, [auth, handleResponse])

  const fetchFeedbacks = useCallback(async () => {
    try {
      const r = await fetch(`${API}/participant/feedbacks`, { headers: auth() })
      const d = await handleResponse(r)
      setFeedbacks(d.feedbacks || [])
    } catch (e) {
      console.error('fetchFeedbacks error:', e.message)
    }
  }, [auth, handleResponse])

  const fetchQuizzes = useCallback(async () => {
    try {
      const r = await fetch(`${API}/ai-quiz/participant/quizzes`, { headers: auth() })
      const d = await handleResponse(r)
      setQuizzes(d.quizzes || [])
    } catch (e) {
      console.error('fetchQuizzes error:', e.message)
    }
  }, [auth, handleResponse])

  useSocketEvent('quiz:published', () => {
    fetchQuizzes()
  }, [fetchQuizzes])

  useSocketEvent('quiz:results:published', () => {
    fetchQuizzes()
  }, [fetchQuizzes])

  const fetchAll = useCallback(() => {
    fetchTrainings(); fetchEnrollments(); fetchFeedbacks(); fetchQuizzes(); fetchParticipantReport()
  }, [fetchTrainings, fetchEnrollments, fetchFeedbacks, fetchQuizzes, fetchParticipantReport])

  useEffect(() => {
    if (user && user.token) {
      fetchAll()
    }
  }, [fetchAll, user])

  useEffect(() => {
    if (tab === 'reports' || tab === 'certificates') {
      fetchParticipantReport()
    }
  }, [tab, fetchParticipantReport])

  // Guard clause for missing/unauthorized user session
  if (!user || !user.token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: "'Manrope', 'Poppins', sans-serif"
      }}>
        <Loader2 style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} size={36} />
        <span style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>Verifying session...</span>
      </div>
    )
  }

  // ─── Mutations ────────────────────────────────────────────────────────────
  const handleEnroll = async (trainingId) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/participant/enroll`, {
        method: 'POST', headers: auth(), body: JSON.stringify({ trainingId }),
      })
      const d = await handleResponse(r)
      success('Enrolled successfully!')
      const t = trainings.find((x) => x.id === trainingId)
      if (t) track({ type: 'course', id: trainingId, title: t.title, subtitle: t.trainerName })
      fetchAll()
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleCancelEnrollment = async (trainingId) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/participant/enroll/${trainingId}`, {
        method: 'DELETE', headers: auth(),
      })
      const d = await handleResponse(r)
      success('Course unenrolled.')
      fetchAll()
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const fetchSurveyQuestions = async (trainingId) => {
    try {
      const r = await fetch(`${API}/survey/${trainingId}`, { headers: auth() })
      const d = await handleResponse(r)
      return d.questions || []
    } catch (e) {
      console.error('fetchSurveyQuestions error:', e.message)
      return []
    }
  }

  const handleSubmitFeedback = async ({ enrollment, fbForm, surveyAnswers }) => {
    setLoading(true)
    try {
      const payload = { trainingId: enrollment.trainingId, ...fbForm, surveyAnswers }
      const r = await fetch(`${API}/feedback`, {
        method: 'POST', headers: auth(), body: JSON.stringify(payload),
      })
      const d = await handleResponse(r)
      success(d.message || 'Feedback submitted successfully!')
      fetchFeedbacks()
    } catch (e) { showError(e.message); throw e }
    finally { setLoading(false) }
  }

  // ─── Quiz state ─────────────────────────────────────────────────────────
  // The secure assessment flow (consent gate → fullscreen → live exam) now
  // lives entirely inside <AIQuizzesDashboard /> — we no longer render
  // <QuizTaking /> from this page. handleStartQuiz remains only as a hook
  // for the continue-learning tracker; the dashboard renders normally.
  const handleStartQuiz = (attemptId, quiz) => {
    if (quiz?.id) track({ type: 'quiz', id: quiz.id, title: quiz.title })
  }
  const handleQuizComplete = (result) => {
    if (result?.percentage != null) success(`Quiz submitted! Score: ${result.percentage.toFixed(1)}%`)
    fetchQuizzes()
  }

  // ─── Continue-learning click handler ──────────────────────────────────────
  const handleResume = (item) => {
    if (item.type === 'course') handleTabChange('available')
    else if (item.type === 'quiz') handleTabChange('ai-quizzes')
    else if (item.type === 'lesson') handleTabChange('lessons')
  }

  return (
    <div className="dashboard" style={{ padding: 0 }}>
      {tab === 'overview' && (
        <motion.div key="overview" {...fadeVariant} transition={{ duration: 0.25 }}>
          <OverviewSection
            user={user}
            trainings={trainings}
            enrollments={enrollments}
            quizzes={quizzes}
            onGoToCourses={() => handleTabChange('available')}
            onResume={handleResume}
            onClickCourse={() => handleTabChange('myEnrollments')}
            onClickQuiz={() => handleTabChange('ai-quizzes')}
          />
        </motion.div>
      )}

      {tab === 'available' && (
        <motion.div key="available" {...fadeVariant} transition={{ duration: 0.25 }}>
          <AvailableCourses
            trainings={trainings}
            enrollments={enrollments}
            loading={loading}
            onEnroll={handleEnroll}
          />
        </motion.div>
      )}

      {tab === 'myEnrollments' && (
        <motion.div key="myEnrollments" {...fadeVariant} transition={{ duration: 0.25 }}>
          <ParticipantCourses user={user} />
        </motion.div>
      )}

      {tab === 'lessons' && (
        <motion.div key="lessons" {...fadeVariant} transition={{ duration: 0.25 }}>
          <LessonsSection />
        </motion.div>
      )}

      {tab === 'ai-quizzes' && (
        <motion.div key="ai-quizzes" {...fadeVariant} transition={{ duration: 0.25 }}>
          <AIQuizList user={user} onStartQuiz={handleStartQuiz} />
        </motion.div>
      )}

      {tab === 'coding' && (
        <motion.div key="coding" {...fadeVariant} transition={{ duration: 0.25 }}>
          <ParticipantCodingList />
        </motion.div>
      )}

      {tab === 'leaderboard' && (
        <motion.div key="leaderboard" {...fadeVariant} transition={{ duration: 0.25 }}>
          <LeaderboardSection
            enrollments={enrollments}
            quizzes={quizzes}
            currentUserId={user?.id}
          />
        </motion.div>
      )}

      {tab === 'achievements' && (
        <motion.div key="achievements" {...fadeVariant} transition={{ duration: 0.25 }}>
          <AchievementsSection user={user} enrollmentsCount={enrollments.length} />
        </motion.div>
      )}

      {tab === 'reports' && (
        <motion.div key="reports" {...fadeVariant} transition={{ duration: 0.25 }} style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Poppins', sans-serif" }}>My Learning Reports</h2>
              <p style={{ color: 'var(--academic-text-muted)', fontSize: 13, margin: '4px 0 0' }}>Detailed overview of your academic progress, quiz history, and assessment scores.</p>
            </div>
            <button className="ac-btn ac-btn-secondary" onClick={fetchParticipantReport}>Refresh Report</button>
          </div>

          {!participantReport ? (
            <div className="ac-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <span style={{ color: 'var(--academic-text-muted)' }}>Loading reports...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Course Progress */}
              <div className="ac-card" style={{ padding: 24 }}>
                <h3 className="ac-section-title" style={{ fontSize: 16, marginBottom: 16 }}>Course &amp; Training Progress</h3>
                {(!participantReport.progress || participantReport.progress.length === 0) ? (
                  <p style={{ color: 'var(--academic-text-muted)', fontSize: 14 }}>You are not enrolled in any courses or training programs yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {participantReport.progress.map((p, idx) => (
                      <div key={idx} style={{ borderBottom: '1px solid var(--academic-border)', paddingBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--academic-text)' }}>{p.title}</span>
                            <span className={`ac-chip ${p.type === 'Course' ? 'ac-chip-primary' : 'ac-chip-success'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                              {p.type}
                            </span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--academic-primary)' }}>{p.progressPercent}%</span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                          <div style={{ width: `${p.progressPercent}%`, height: '100%', background: 'var(--academic-primary)' }}></div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--academic-text-muted)' }}>
                          Completed Lessons: {p.completedLessons} / {p.totalLessons}
                          {p.certificateAvailable && (
                            <span style={{ marginLeft: 16, color: '#10b981', fontWeight: 600 }}>
                              ✓ Certificate Available ({p.certificateCode})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quiz History */}
              <div className="ac-card" style={{ padding: 24 }}>
                <h3 className="ac-section-title" style={{ fontSize: 16, marginBottom: 16 }}>Quiz History</h3>
                {(!participantReport.quizHistory || participantReport.quizHistory.length === 0) ? (
                  <p style={{ color: 'var(--academic-text-muted)', fontSize: 14 }}>No quiz attempts recorded yet.</p>
                ) : (
                  <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Quiz Title</th>
                          <th style={{ textAlign: 'center' }}>Score</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participantReport.quizHistory.map((q, idx) => (
                          <tr key={idx}>
                            <td className="font-medium" style={{ color: 'var(--academic-text)' }}>{q.quizTitle}</td>
                            <td style={{ textAlign: 'center' }}>
                              {q.isPublished ? (
                                <span className="ac-chip ac-chip-success" style={{ fontWeight: 600 }}>
                                  {q.score}%
                                </span>
                              ) : (
                                <span className="ac-chip" style={{ background: '#fef3c7', color: '#92400e' }}>
                                  —
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`ac-chip ${q.isPublished ? 'ac-chip-success' : ''}`}>
                                {q.isPublished ? 'Published' : 'Pending Publication'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--academic-text-muted)', fontSize: 12 }}>
                              {new Date(q.date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Assessment History */}
              <div className="ac-card" style={{ padding: 24 }}>
                <h3 className="ac-section-title" style={{ fontSize: 16, marginBottom: 16 }}>Assessment History</h3>
                {(!participantReport.assessmentHistory || participantReport.assessmentHistory.length === 0) ? (
                  <p style={{ color: 'var(--academic-text-muted)', fontSize: 14 }}>No assessment submissions recorded yet.</p>
                ) : (
                  <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Assessment</th>
                          <th style={{ textAlign: 'center' }}>Score</th>
                          <th>Status</th>
                          <th>Feedback</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participantReport.assessmentHistory.map((ah, idx) => (
                          <tr key={idx}>
                            <td className="font-medium" style={{ color: 'var(--academic-text)' }}>{ah.assessmentTitle}</td>
                            <td style={{ textAlign: 'center' }}>
                              {ah.score !== null ? (
                                <span className="ac-chip ac-chip-primary" style={{ fontWeight: 600 }}>
                                  {ah.score} / {ah.maxScore}
                                </span>
                              ) : (
                                <span className="ac-chip">Pending Grade</span>
                              )}
                            </td>
                            <td>
                              <span className={`ac-chip ${ah.status === 'PUBLISHED' || ah.status === 'REVIEWED' ? 'ac-chip-success' : 'ac-chip-primary'}`}>
                                {ah.status}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--academic-text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ah.feedback || '—'}
                            </td>
                            <td style={{ color: 'var(--academic-text-muted)', fontSize: 12 }}>
                              {new Date(ah.date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {tab === 'certificates' && (
        <motion.div key="certificates" {...fadeVariant} transition={{ duration: 0.25 }} style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Poppins', sans-serif" }}>My Certificates</h2>
              <p style={{ color: 'var(--academic-text-muted)', fontSize: 13, margin: '4px 0 0' }}>View and download your official completion certificates.</p>
            </div>
            <button className="ac-btn ac-btn-secondary" onClick={fetchParticipantReport}>Refresh</button>
          </div>

          {!participantReport ? (
            <div className="ac-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <span style={{ color: 'var(--academic-text-muted)' }}>Loading certificates...</span>
            </div>
          ) : (!participantReport.certificates || participantReport.certificates.length === 0) ? (
            <div className="ac-card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ color: 'var(--academic-text-muted)' }}>No certificates earned yet. Complete 100% of your course requirements, quizzes, and assessments to earn your certificate!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              {participantReport.certificates.map((cert, idx) => (
                <div key={idx} className="ac-card" style={{
                  padding: 24,
                  border: '2px solid var(--academic-primary)',
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(255,255,255,0.02) 100%)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Certificate Frame Effect */}
                  <div style={{
                    border: '1px solid rgba(79, 70, 229, 0.2)',
                    padding: 20,
                    borderRadius: 8,
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--academic-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                      Wave Init LMS Certificate
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Poppins', sans-serif", color: 'var(--academic-text)', marginBottom: 8 }}>
                      Certificate of Completion
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--academic-text-secondary)', marginBottom: 16 }}>
                      This is proudly presented to
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--academic-text)', textDecoration: 'underline', marginBottom: 16, fontFamily: "'Poppins', sans-serif" }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--academic-text-secondary)', marginBottom: 8 }}>
                      for successfully completing all requirements for
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--academic-text)', marginBottom: 20 }}>
                      {cert.title}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--academic-text-muted)', borderTop: '1px solid var(--academic-border)', paddingTop: 12 }}>
                      <div>
                        <strong>Date Issued:</strong> {new Date(cert.issuedAt).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Verification Code:</strong> {cert.certificateCode}
                      </div>
                    </div>
                  </div>
                  <button
                    className="ac-btn ac-btn-primary"
                    style={{ width: '100%', marginTop: 16 }}
                    onClick={() => {
                      const printContent = `
                        <html>
                          <head>
                            <title>Certificate - ${cert.title}</title>
                            <style>
                              body { font-family: 'Poppins', 'Poppins', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #fff; color: #000; }
                              .cert-container { border: 15px double #4f46e5; padding: 50px; width: 650px; text-align: center; border-radius: 4px; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
                              .title { font-size: 32px; font-weight: 700; color: #1e1b4b; margin-bottom: 10px; }
                              .subtitle { font-size: 16px; color: #4b5563; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; }
                              .presented { font-size: 14px; font-style: italic; color: #6b7280; margin-bottom: 20px; }
                              .name { font-size: 28px; font-weight: 700; color: #4f46e5; border-bottom: 2px solid #e5e7eb; display: inline-block; padding-bottom: 5px; margin-bottom: 30px; }
                              .reason { font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 40px; }
                              .course-title { font-size: 20px; font-weight: 600; color: #1f2937; }
                              .footer { display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                            </style>
                          </head>
                          <body>
                            <div class="cert-container">
                              <div class="subtitle">Wave Init LMS Certificate</div>
                              <div class="title">Certificate of Completion</div>
                              <div class="presented">This is proudly presented to</div>
                              <div class="name">${user.name}</div>
                              <div class="reason">for successfully completing all academic requirements, lessons, quizzes, and assessments for the course:</div>
                              <div class="reason"><span class="course-title">${cert.title}</span></div>
                              <div class="footer">
                                <div><strong>Date Issued:</strong> ${new Date(cert.issuedAt).toLocaleDateString()}</div>
                                <div><strong>Verification Code:</strong> ${cert.certificateCode}</div>
                              </div>
                            </div>
                            <script>window.onload = function() { window.print(); }</script>
                          </body>
                        </html>
                      `;
                      const win = window.open('', '_blank');
                      win.document.write(printContent);
                      win.document.close();
                    }}
                  >
                    Print Certificate
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === 'feedback' && (
        <motion.div key="feedback" {...fadeVariant} transition={{ duration: 0.25 }}>
          <FeedbackSection
            enrollments={enrollments}
            feedbacks={feedbacks}
            loading={loading}
            onSubmit={handleSubmitFeedback}
            fetchQuestions={fetchSurveyQuestions}
          />
        </motion.div>
      )}

      {tab === 'myFeedbacks' && (
        <motion.div key="myFeedbacks" {...fadeVariant} transition={{ duration: 0.25 }}>
          <MyFeedbacks feedbacks={feedbacks} loading={loading} />
        </motion.div>
      )}

      {tab === 'profile' && (
        <motion.div key="profile" {...fadeVariant} transition={{ duration: 0.25 }}>
          <ProfileSection
            user={user}
            enrollments={enrollments}
            quizzes={quizzes}
            onResume={handleResume}
            onTabChange={handleTabChange}
          />
        </motion.div>
      )}
    </div>
  )
}

export default ParticipantDashboard
