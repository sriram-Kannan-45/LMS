import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Users, Star, FileText, CheckCircle, XCircle, Clock, MessageSquare, TrendingUp, Monitor, Shield } from 'lucide-react'
import TrainerForm from '../components/TrainerForm'
import NotesSection from '../components/trainer/notes/NotesSection'
import ParticipantProfileView from '../components/shared/ParticipantProfileView'
import TrainerCourses from './TrainerCourses'
import TrainerCodingAssessments from '../components/coding-assessment/TrainerCodingAssessments'
import { useToast } from '../components/Toast'
import Pagination from '../components/Pagination'
import SortableTableHeader from '../components/SortableTableHeader'

import { API_BASE } from '../api/api'

const API = API_BASE

function TrainerDashboard({ user, onLogout, activeTab, onTabChange }) {
  const navigate = useNavigate()
  const { success, error: showError, info } = useToast()
  const tab = activeTab === 'trainings' ? 'courses' : (activeTab || 'courses')
  const [trainings, setTrainings] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [stats, setStats] = useState({ totalTrainings: 0, avgTrainerRating: 0, avgSubjectRating: 0, totalFeedbacks: 0 })
  const [feedbackSort, setFeedbackSort] = useState({ key: '', direction: 'asc' })
  const [feedbackPage, setFeedbackPage] = useState(1)
  const feedbackItemsPerPage = 5

  const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` })

  const [replyModal, setReplyModal] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [viewingParticipant, setViewingParticipant] = useState(null)
  const [enrollmentRequests, setEnrollmentRequests] = useState([])
  const [trainerReport, setTrainerReport] = useState(null)

  const fetchEnrollmentRequests = async () => {
    try {
      const r = await fetch(`${API}/trainer/enrollment-requests`, { headers: auth() })
      const d = await r.json()
      if (r.ok && d.success) {
        setEnrollmentRequests(d.pendingRequests || [])
      }
    } catch (e) {
      console.error('fetchEnrollmentRequests error:', e.message)
    }
  }

  const fetchTrainerReport = async () => {
    try {
      const r = await fetch(`${API}/reports/trainer`, { headers: auth() })
      const d = await r.json()
      if (r.ok && d.success) {
        setTrainerReport(d.data)
      }
    } catch (e) {
      console.error('fetchTrainerReport error:', e.message)
    }
  }

  const handleApproveEnrollment = async (requestId) => {
    try {
      const r = await fetch(`${API}/trainer/enrollment-requests/${requestId}/approve`, {
        method: 'POST',
        headers: auth()
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      success('Enrollment request approved successfully!')
      fetchEnrollmentRequests()
    } catch (e) {
      showError(e.message)
    }
  }

  const handleRejectEnrollment = async (requestId) => {
    try {
      const r = await fetch(`${API}/trainer/enrollment-requests/${requestId}/reject`, {
        method: 'POST',
        headers: auth()
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      success('Enrollment request rejected.')
      fetchEnrollmentRequests()
    } catch (e) {
      showError(e.message)
    }
  }

  const handleRegenerateCertificate = async () => {
    try {
      const r = await fetch(`${API}/trainer/certificates/regenerate`, {
        method: 'POST',
        headers: auth()
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      success('Certificate check/regeneration triggered successfully!')
      fetchTrainerReport()
    } catch (e) {
      showError(e.message)
    }
  }

  useEffect(() => {
    if (tab === 'enrollments') {
      fetchEnrollmentRequests()
    } else if (tab === 'reports') {
      fetchTrainerReport()
    }
  }, [tab])

  useEffect(() => {
    fetchTrainings()
    fetchFeedbacks()
  }, [])

  const fetchTrainings = async () => {
    try {
      const r = await fetch(`${API}/trainer/trainings`, { headers: auth() })
      const d = await r.json()
      console.log('DEBUG - API Response (/trainer/trainings):', d)
      const list = d.trainings || []
      setTrainings(list)
      setStats(p => ({ ...p, totalTrainings: list.length }))
    } catch (e) {
      console.error('DEBUG - fetchTrainings error:', e.message)
    }
  }

  const fetchFeedbacks = async () => {
    try {
      const r = await fetch(`${API}/trainer/feedbacks`, { headers: auth() })
      const d = await r.json()
      console.log('DEBUG - API Response (/trainer/feedbacks):', d)
      const list = d.feedbacks || []
      setFeedbacks(list)
      setStats(p => ({
        ...p,
        avgTrainerRating: d.averageTrainerRating || 0,
        avgSubjectRating: d.averageSubjectRating || 0,
        totalFeedbacks: list.length
      }))
    } catch (e) {
      console.error('DEBUG - fetchFeedbacks error:', e.message)
    }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    try {
      const r = await fetch(`${API}/feedback/${replyModal.id}/reply`, {
        method: 'POST', headers: auth(), body: JSON.stringify({ trainerResponse: replyText })
      })
      const d = await r.json().catch(() => ({}))
      console.log("STATUS:", r.status);
      console.log("DATA:", d);

      if (!r.ok || d.success === false) {
        showError(d.error || d.message || 'Failed to save reply')
        return
      }

      success('Reply submitted successfully!')
      setReplyModal(null)
      setReplyText('')
      fetchFeedbacks()
    } catch (e) {
      showError(e.message)
    }
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
  const Stars = ({ v }) => <span className="stars">{[1,2,3,4,5].map(s => <span key={s} className={`star ${s<=v?'filled':''}`}>&#9733;</span>)}</span>
  const initials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : 'TR'

  // Sort feedbacks
  const sortedFeedbacks = [...feedbacks].sort((a, b) => {
    if (!feedbackSort.key) return 0
    const aVal = a[feedbackSort.key] ?? ''
    const bVal = b[feedbackSort.key] ?? ''
    const comparison = String(aVal).localeCompare(String(bVal))
    return feedbackSort.direction === 'asc' ? comparison : -comparison
  })

  // Paginate feedbacks
  const paginatedFeedbacks = sortedFeedbacks.slice(
    (feedbackPage - 1) * feedbackItemsPerPage,
    feedbackPage * feedbackItemsPerPage
  )
  const totalFeedbackPages = Math.ceil(sortedFeedbacks.length / feedbackItemsPerPage)

  const handleFeedbackSort = (key) => {
    setFeedbackSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Assigned Trainings</div>
          <div className="stat-value">{stats.totalTrainings}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Feedback Responses</div>
          <div className="stat-value">{stats.totalFeedbacks}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Avg Trainer Rating</div>
          <div className="stat-value">{stats.avgTrainerRating}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Avg Subject Rating</div>
          <div className="stat-value">{stats.avgSubjectRating}</div>
        </div>
      </div>

      {tab === 'courses' && (
        <TrainerCourses user={user} />
      )}

      {tab === 'feedback' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card">
            <div className="card-header">
              <h3>Feedback Received ({feedbacks.length})</h3>
            </div>
            {feedbacks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <h3>No Feedback Yet</h3>
                <p>Feedback from participants will appear here once they start submitting.</p>
              </div>
            ) : (
              <>
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <SortableTableHeader sortKey="trainingTitle" currentSort={feedbackSort.key} sortDirection={feedbackSort.direction} onSort={handleFeedbackSort}>Training</SortableTableHeader>
                        <th>Participant</th>
                        <SortableTableHeader sortKey="trainerRating" currentSort={feedbackSort.key} sortDirection={feedbackSort.direction} onSort={handleFeedbackSort} numeric>Trainer Rating</SortableTableHeader>
                        <SortableTableHeader sortKey="subjectRating" currentSort={feedbackSort.key} sortDirection={feedbackSort.direction} onSort={handleFeedbackSort} numeric>Subject Rating</SortableTableHeader>
                        <th>Comments</th>
                        <th>My Reply</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFeedbacks.map(f => (
                        <tr key={f.id}>
                          <td><strong>{f.trainingTitle}</strong></td>
                          <td>{f.anonymous ? <span className="badge badge-gray">Anonymous</span> : (
                            f.participantId ? (
                              <button
                                type="button"
                                onClick={() => setViewingParticipant({ id: f.participantId, name: f.participantName })}
                                style={{
                                  background: 'transparent',
                                  border: 0,
                                  padding: 0,
                                  color: 'var(--text-link, #2563eb)',
                                  cursor: 'pointer',
                                  font: 'inherit',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: 2,
                                }}
                                title="View profile"
                              >
                                {f.participantName}
                              </button>
                            ) : f.participantName
                          )}</td>
                          <td><Stars v={f.trainerRating} /></td>
                          <td><Stars v={f.subjectRating} /></td>
                          <td style={{ maxWidth: 200, fontSize: 12, color: 'var(--text-secondary)' }}>{f.comments || '-'}</td>
                          <td style={{ maxWidth: 200, fontSize: 12 }}>
                            {f.trainerResponse ? (
                              <span style={{ color: 'var(--text-secondary)' }}>{f.trainerResponse}</span>
                            ) : (
                              <button className="btn btn-sm btn-primary" onClick={() => { setReplyModal(f); setReplyText(''); }}>
                                <MessageSquare size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Reply
                              </button>
                            )}
                          </td>
                          <td>{fmtDate(f.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalFeedbackPages > 1 && (
                  <Pagination
                    currentPage={feedbackPage}
                    totalPages={totalFeedbackPages}
                    onPageChange={setFeedbackPage}
                  />
                )}
              </>
            )}
          </div>
        </motion.div>
      )}

      {tab === 'notes' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <NotesSection user={user} />
        </motion.div>
      )}

      {tab === 'coding' && (
        <TrainerCodingAssessments />
      )}

      {tab === 'enrollments' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Enrollment Requests</h3>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Review and approve participant access requests</span>
              </div>
              <button className="btn btn-sm" onClick={fetchEnrollmentRequests}>Refresh</button>
            </div>
            
            {enrollmentRequests.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center' }}>
                <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-muted)' }}>No pending enrollment requests.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Target Training</th>
                      <th>Type</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollmentRequests.map(req => (
                      <tr key={req.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{req.participant?.name || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{req.participant?.email}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 550 }}>{req.course?.title || req.training?.title || 'Unknown'}</div>
                        </td>
                        <td>
                          <span className="ac-chip ac-chip-success">
                            Training
                          </span>
                        </td>
                        <td style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button className="btn btn-sm btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }} onClick={() => handleApproveEnrollment(req.id)}>
                            Approve
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleRejectEnrollment(req.id)}>
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {tab === 'reports' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: "'Poppins', sans-serif" }}>Trainer Reports &amp; Analytics</h3>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>View participant progress, quiz results, and review submissions</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => navigate('/trainer/courses')}>
                  <Monitor style={{ width: 14, height: 14, marginRight: 4 }} />
                  Assessments
                </button>
                <button className="btn btn-sm btn-secondary" onClick={handleRegenerateCertificate}>Check/Issue Certificates</button>
                <button className="btn btn-sm btn-primary" onClick={fetchTrainerReport}>Refresh Data</button>
              </div>
            </div>

          {!trainerReport ? (
            <div className="card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Loading report data...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Stats Card */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TrendingUp style={{ color: '#4f46e5' }} />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 550 }}>Average Progress Rate</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Poppins', sans-serif" }}>{trainerReport.averageCompletion}%</div>
                  </div>
                </div>
              </div>

              {/* Participant Progress Grid */}
              <div className="card">
                <div className="card-header">
                  <h3>Participant Progress</h3>
                </div>
                {(!trainerReport.participantProgress || trainerReport.participantProgress.length === 0) ? (
                  <div className="empty-state" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No participants enrolled yet.</div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Training</th>
                          <th>Type</th>
                          <th>Lessons Completed</th>
                          <th>Progress</th>
                          <th>Avg Quiz Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainerReport.participantProgress.map((p, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{p.participantName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.participantEmail}</div>
                            </td>
                            <td>{p.title}</td>
                            <td>
                              <span className="ac-chip ac-chip-success">
                                Training
                              </span>
                            </td>
                            <td>{p.completedLessons} / {p.totalLessons}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                                  <div style={{ width: `${p.progressPercent}%`, height: '100%', background: '#4f46e5' }}></div>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{p.progressPercent}%</span>
                              </div>
                            </td>
                            <td>
                              <span className="ac-chip ac-chip-success" style={{ fontWeight: 600 }}>
                                {p.avgQuizScore}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pending Reviews */}
              <div className="card">
                <div className="card-header">
                  <h3>Pending Assessment Reviews</h3>
                </div>
                {(!trainerReport.pendingReviews || trainerReport.pendingReviews.length === 0) ? (
                  <div className="empty-state" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No pending reviews. All submissions graded!</div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Assessment</th>
                          <th>Max Score</th>
                          <th>Submitted At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainerReport.pendingReviews.map((pr, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{pr.participantName}</td>
                            <td>{pr.assessmentTitle}</td>
                            <td>{pr.maxScore}</td>
                            <td>{fmtDate(pr.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quiz History */}
              <div className="card">
                <div className="card-header">
                  <h3>Recent Quiz Results</h3>
                </div>
                {(!trainerReport.quizScores || trainerReport.quizScores.length === 0) ? (
                  <div className="empty-state" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No quiz submissions yet.</div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Quiz</th>
                          <th>Score</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainerReport.quizScores.map((qs, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{qs.participantName}</td>
                            <td>{qs.quizTitle}</td>
                            <td>
                              <span className="ac-chip ac-chip-success" style={{ fontWeight: 600 }}>
                                {qs.score}%
                              </span>
                            </td>
                            <td>{fmtDate(qs.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Assessment Scores */}
              <div className="card">
                <div className="card-header">
                  <h3>Graded Assessments</h3>
                </div>
                {(!trainerReport.assessmentScores || trainerReport.assessmentScores.length === 0) ? (
                  <div className="empty-state" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No graded submissions yet.</div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Assessment</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainerReport.assessmentScores.map((as, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{as.participantName}</td>
                            <td>{as.assessmentTitle}</td>
                            <td>{as.score} / {as.maxScore}</td>
                            <td>
                              <span className={`ac-chip ${as.status === 'PUBLISHED' ? 'ac-chip-success' : 'ac-chip-primary'}`}>
                                {as.status}
                              </span>
                            </td>
                            <td>{fmtDate(as.date)}</td>
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

      {tab === 'profile' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="card">
            <div className="card-header">
              <h3>My Profile</h3>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manage your trainer profile & photo</span>
            </div>
            <TrainerForm user={user} />
          </div>
        </motion.div>
      )}

      {replyModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Reply to Feedback</h3>
              <button className="modal-close" onClick={() => setReplyModal(null)}>&#10005;</button>
            </div>
            <form onSubmit={handleReply}>
              <div className="form-group">
                <label className="form-label">Your Response</label>
                <textarea className="form-control" value={replyText} required onChange={e => setReplyText(e.target.value)} placeholder="Type your response..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setReplyModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Reply</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ParticipantProfileView
        open={!!viewingParticipant}
        userId={viewingParticipant?.id}
        fallback={viewingParticipant ? { name: viewingParticipant.name } : null}
        onClose={() => setViewingParticipant(null)}
      />
    </div>
  )
}

export default TrainerDashboard
