import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import TrainerList from '../components/TrainerList'
import ParticipantList from '../components/ParticipantList'
import ParticipantProfileView from '../components/shared/ParticipantProfileView'
import AssessmentSessionsPanel from '../components/admin/AssessmentSessionsPanel'
import AnimatedDropdown from '../components/AnimatedDropdown'
import { useToast } from '../components/Toast'
import Skeleton, { SkeletonTable } from '../components/Skeleton'
import { API, API_BASE } from '../api/api'
import { Loader2, TrendingUp, MessageSquare, Star } from 'lucide-react'
import AdminOverviewTab from '../components/admin/tabs/AdminOverviewTab'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'
const initials = (name) => name ? name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'AD'
const Stars = ({ v }) => (
  <span className="stars">
    {[1,2,3,4,5].map(s => <span key={s} className={`star ${s <= v ? 'filled' : ''}`}>&#9733;</span>)}
  </span>
)

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }
}

function AdminDashboard({ user, onLogout, activeTab, onTabChange }) {
  const { success, error: showError, info, warning } = useToast()
  const [tab, setTab] = useState(activeTab || 'overview')

  useEffect(() => {
    if (activeTab) setTab(activeTab)
  }, [activeTab])

  const handleTabChange = (newTab) => {
    setTab(newTab)
    if (onTabChange) onTabChange(newTab)
  }
  const [trainers, setTrainers] = useState([])
  const [trainings, setTrainings] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [participants, setParticipants] = useState([])
  const [pendingParticipants, setPendingParticipants] = useState([])
  const [questions, setQuestions] = useState([])
  const [notes, setNotes] = useState([])
  const [noteFilter, setNoteFilter] = useState('')
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [viewingParticipant, setViewingParticipant] = useState(null)
  const [credentials, setCredentials] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [adminReport, setAdminReport] = useState(null)

  const [trainerForm, setTrainerForm] = useState({ name: '', email: '', password: '' })
  const [trainingForm, setTrainingForm] = useState({ title: '', description: '', trainerId: '', trainerIds: [], startDate: '', endDate: '', capacity: '', sequentialLearning: false })
  const [questionForm, setQuestionForm] = useState({ trainingId: '', questionText: '', questionType: 'TEXT', options: '' })
  const [addParticipantModal, setAddParticipantModal] = useState(false)
  const [participantForm, setParticipantForm] = useState({ name: '', email: '', phone: '', password: '' })

  // Programs & Courses state
  const [programs, setPrograms] = useState([])
  const [courses, setCourses] = useState([])
  const [programForm, setProgramForm] = useState({ title: '', description: '' })
  const [courseForm, setCourseForm] = useState({ title: '', description: '', trainerId: '', programId: '', status: 'ACTIVE' })

  const [initialLoading, setInitialLoading] = useState(true)
  const [confirmModal, setConfirmModal] = useState(null)

  const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` })

  const fetchAdminReport = async () => {
    try {
      const r = await fetch(`${API_BASE}/reports/admin`, { headers: auth() })
      const d = await r.json()
      if (r.ok && d.success) {
        setAdminReport(d.data)
      }
    } catch (e) {
      console.error('fetchAdminReport error:', e.message)
    }
  }

  useEffect(() => {
    const loadAll = async () => {
      setInitialLoading(true)
      try {
        await fetchAll()
      } finally {
        setInitialLoading(false)
      }
    }
    loadAll()
  }, [])

  useEffect(() => {
    if (tab === 'reports') {
      fetchAdminReport()
    }
  }, [tab])

  const fetchAll = async () => {
    await Promise.all([
      fetchStats(),
      fetchTrainers(),
      fetchTrainings(),
      fetchFeedbacks(),
      fetchParticipants(),
      fetchQuestions(),
      fetchPendingParticipants(),
      fetchNotes(),
      fetchPrograms(),
      fetchCourses(),
      fetchAdminReport()
    ])
  }

  const fetchStats = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/stats`, { headers: auth() })
      if (r.ok) setStats(await r.json())
    } catch {}
  }

  const fetchPendingParticipants = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/pending-participants`, { headers: auth() })
      const d = await r.json()
      setPendingParticipants(d.participants || [])
    } catch {}
  }

  const handleApproveParticipant = async (id) => {
    setConfirmModal({ action: 'approve-participant', id, title: 'Approve Participant?' })
  }

  const confirmAction = async () => {
    if (!confirmModal) return
    setLoading(true)
    try {
      if (confirmModal.action === 'approve-participant') {
        const r = await fetch(`${API_BASE}/admin/approve-participant/${confirmModal.id}`, { method: 'POST', headers: auth() })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        success('Participant approved successfully')
        fetchPendingParticipants(); fetchParticipants()
      } else if (confirmModal.action === 'delete-question') {
        const r = await fetch(`${API_BASE}/survey/${confirmModal.id}`, { method: 'DELETE', headers: auth() })
        if (!r.ok) throw new Error('Failed to delete question')
        success('Question deleted')
        fetchQuestions()
      } else if (confirmModal.action === 'delete-training') {
        const r = await fetch(`${API_BASE}/admin/trainings/${confirmModal.id}`, { method: 'DELETE', headers: auth() })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        success('Training deleted successfully')
        fetchTrainings(); fetchStats()
      } else if (confirmModal.action === 'delete-participant') {
        const r = await fetch(`${API_BASE}/admin/participants/${confirmModal.id}`, { method: 'DELETE', headers: auth() })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        success('Participant removed successfully')
        fetchParticipants(); fetchStats()
      } else if (confirmModal.action === 'delete-trainer') {
        const r = await fetch(`${API_BASE}/admin/trainers/${confirmModal.id}`, { method: 'DELETE', headers: auth() })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        success('Trainer removed successfully')
        fetchTrainers(); fetchStats()
      } else if (confirmModal.action === 'delete-program') {
        const r = await fetch(`${API_BASE}/admin/training-programs/${confirmModal.id}`, { method: 'DELETE', headers: auth() })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        success('Program deleted successfully')
        fetchPrograms()
      } else if (confirmModal.action === 'delete-course') {
        const r = await fetch(`${API_BASE}/admin/courses/${confirmModal.id}`, { method: 'DELETE', headers: auth() })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error)
        success('Course deleted successfully')
        fetchCourses()
      }
    } catch (e) { 
      showError(e.message) 
    } finally { 
      setLoading(false)
      setConfirmModal(null)
    }
  }

  const fetchTrainers = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/trainers`, { headers: auth() })
      const d = await r.json()
      const trainers = d.trainers || (d.data && d.data.trainers) || []
      setTrainers(trainers)
    } catch (e) { console.error('fetchTrainers error:', e.message) }
  }

  const fetchTrainings = async () => {
    try {
      const r = await fetch(`${API_BASE}/trainings`, { headers: auth() })
      const d = await r.json()
      setTrainings(Array.isArray(d) ? d : (d.trainings || []))
    } catch {}
  }

  const fetchFeedbacks = async () => {
    try {
      const r = await fetch(`${API_BASE}/feedback/admin-feedbacks`, { headers: auth() })
      const d = await r.json()
      setFeedbacks(d.feedbacks || [])
    } catch {}
  }

  const fetchParticipants = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/participants`, { headers: auth() })
      const d = await r.json()
      const participants = d.participants || (d.data && d.data.participants) || []
      setParticipants(participants)
    } catch (e) { console.error('fetchParticipants error:', e.message) }
  }

  const fetchQuestions = async () => {
    try {
      const r = await fetch(`${API_BASE}/survey`, { headers: auth() })
      const d = await r.json()
      setQuestions(d.questions || [])
    } catch {}
  }

  const fetchNotes = async (status = '') => {
    try {
      const url = status 
        ? `${API_BASE}/notes/admin/notes?status=${status}`
        : `${API_BASE}/notes/admin/notes`
      const r = await fetch(url, { headers: auth() })
      const d = await r.json()
      setNotes(d.notes || [])
    } catch {}
  }

  const fetchPrograms = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/training-programs`, { headers: auth() })
      const d = await r.json()
      setPrograms(d.programs || (d.data && d.data.programs) || [])
    } catch {}
  }

  const fetchCourses = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/courses`, { headers: auth() })
      const d = await r.json()
      setCourses(d.courses || (d.data && d.data.courses) || [])
    } catch {}
  }

  const handleApproveNote = async (noteId) => {
    setLoading(true)
    try {
      setNotes(prev => prev.filter(note => note.id !== noteId))
      const r = await fetch(`${API_BASE}/notes/${noteId}/status`, {
        method: 'PUT',
        headers: auth(),
        body: JSON.stringify({ status: 'APPROVED' })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to approve note')
      success('Note approved successfully!')
    } catch (e) {
      await fetchNotes(noteFilter)
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRejectNote = async (noteId) => {
    setLoading(true)
    try {
      setNotes(prev => prev.filter(note => note.id !== noteId))
      const r = await fetch(`${API_BASE}/notes/${noteId}/status`, {
        method: 'PUT',
        headers: auth(),
        body: JSON.stringify({ status: 'REJECTED' })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to reject note')
      success('Note rejected successfully!')
    } catch (e) {
      await fetchNotes(noteFilter)
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTrainer = async (e) => {
    e.preventDefault(); setLoading(true); setCredentials(null)
    try {
      const r = await fetch(`${API_BASE}/admin/create-trainer`, { method: 'POST', headers: auth(), body: JSON.stringify(trainerForm) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setTrainerForm({ name: '', email: '', password: '' })
      fetchTrainers(); fetchStats()
      success('Trainer account created successfully.')
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleCreateTraining = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const body = {
        title: trainingForm.title,
        description: trainingForm.description,
        trainerId: trainingForm.trainerId ? parseInt(trainingForm.trainerId) : undefined,
        trainerIds: (trainingForm.trainerIds || []).map(id => parseInt(id)),
        startDate: trainingForm.startDate,
        endDate: trainingForm.endDate,
        capacity: trainingForm.capacity ? parseInt(trainingForm.capacity) : null,
        sequentialLearning: !!trainingForm.sequentialLearning
      }
      const r = await fetch(`${API_BASE}/admin/trainings`, {
        method: 'POST', headers: auth(),
        body: JSON.stringify(body)
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setTrainingForm({ title: '', description: '', trainerId: '', trainerIds: [], startDate: '', endDate: '', capacity: '', sequentialLearning: false })
      fetchTrainings(); fetchStats()
      success('Training session created successfully.')
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleCreateQuestion = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const opts = questionForm.options.split(',').map(s => s.trim()).filter(Boolean)
      const body = { ...questionForm, options: questionForm.questionType === 'MULTIPLE_CHOICE' ? opts : null }
      const r = await fetch(`${API}/survey`, { method: 'POST', headers: auth(), body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setQuestionForm({ trainingId: '', questionText: '', questionType: 'TEXT', options: '' })
      fetchQuestions()
      success('Survey question created.')
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleCreateParticipant = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const r = await fetch(API.REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(participantForm)
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setParticipantForm({ name: '', email: '', phone: '', password: '' })
      setAddParticipantModal(false)
      fetchParticipants(); fetchStats()
      success('Participant account created successfully.')
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleCreateProgram = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/admin/training-programs`, {
        method: 'POST', headers: auth(),
        body: JSON.stringify(programForm)
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setProgramForm({ title: '', description: '' })
      fetchPrograms()
      success('Program created successfully.')
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleCreateCourse = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const body = {
        title: courseForm.title,
        description: courseForm.description,
        trainerId: parseInt(courseForm.trainerId),
        programId: courseForm.programId ? parseInt(courseForm.programId) : undefined,
        status: courseForm.status
      }
      const r = await fetch(`${API_BASE}/admin/training-programs/${courseForm.programId}/courses`, {
        method: 'POST', headers: auth(),
        body: JSON.stringify(body)
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setCourseForm({ title: '', description: '', trainerId: '', programId: '', status: 'ACTIVE' })
      fetchCourses(); fetchPrograms()
      success('Course created successfully.')
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleDeleteQuestion = async (id) => {
    setConfirmModal({ action: 'delete-question', id, title: 'Delete Question?' })
  }

  const handleDeleteTraining = async (id, title) => {
    setConfirmModal({ action: 'delete-training', id, title: `Delete training "${title}"?`, subtitle: 'This will remove all associated enrollments and feedback.' })
  }

  const handleDeleteParticipant = async (id, name) => {
    setConfirmModal({ action: 'delete-participant', id, title: `Delete participant "${name}"?`, subtitle: 'All their enrollments and feedback will also be removed.' })
  }

  const handleDeleteTrainer = async (id, name) => {
    setConfirmModal({ action: 'delete-trainer', id, title: `Delete trainer "${name}"?`, subtitle: 'Their training assignments will be unlinked.' })
  }

  const handleDeleteProgram = async (id, name) => {
    setConfirmModal({ action: 'delete-program', id, title: `Delete program "${name}"?` })
  }

  const handleDeleteCourse = async (id, name) => {
    setConfirmModal({ action: 'delete-course', id, title: `Delete course "${name}"?` })
  }

  const openEdit = (t) => {
    setEditModal(t)
    setEditForm({
      title: t.title,
      description: t.description || '',
      trainerId: t.trainerId || '',
      trainerIds: t.trainerIds || (t.trainerId ? [t.trainerId] : []),
      startDate: t.startDate ? t.startDate.slice(0, 16) : '',
      endDate: t.endDate ? t.endDate.slice(0, 16) : '',
      capacity: t.capacity || '',
      sequentialLearning: t.sequentialLearning || false
    })
  }

  const handleUpdateTraining = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/admin/trainings/${editModal.id}`, {
        method: 'PUT', headers: auth(),
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          trainerId: editForm.trainerId ? parseInt(editForm.trainerId) : undefined,
          trainerIds: (editForm.trainerIds || []).map(id => parseInt(id)),
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          capacity: editForm.capacity ? parseInt(editForm.capacity) : null,
          sequentialLearning: !!editForm.sequentialLearning
        })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setEditModal(null); fetchTrainings()
      success('Training updated successfully.')
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const handleSendReminders = async (trainingId) => {
    setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/admin/send-reminders/${trainingId}`, { method: 'POST', headers: auth() })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      info(d.message)
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'pending', label: 'Pending Approval' },
    { key: 'trainings', label: 'Trainings' },
    { key: 'trainers', label: 'Trainers' },
    { key: 'participants', label: 'Participants' },
    { key: 'sessions', label: 'Assessment Sessions' },
    { key: 'notes', label: 'Notes Management' },
    { key: 'feedback', label: 'Feedback Reports' },
    { key: 'surveys', label: 'Survey Config' },
    { key: 'reports', label: 'Reports & Analytics' },
  ]

  if (!user || !user.token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--academic-bg)'
      }}>
        <Loader2 style={{ animation: 'spin 1s linear infinite', color: 'var(--academic-primary)' }} size={24} />
        <span style={{ marginTop: '12px', fontSize: '13px', color: 'var(--academic-text-muted)' }}>Verifying session...</span>
      </div>
    )
  }

  const pageTitle = (title) => (
    <h1 style={{
      fontFamily: "'Poppins', sans-serif",
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      color: 'var(--academic-text)',
      lineHeight: 1.2,
      margin: 0
    }}>{title}</h1>
  )

  return (
    <motion.div
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <AdminOverviewTab
          user={user}
          stats={stats}
          feedbacks={feedbacks}
          initialLoading={initialLoading}
          loading={loading}
        />
      )}

      {/* ── PENDING APPROVAL ── */}
      {tab === 'pending' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Pending Approval')}
          </div>
          {initialLoading ? (
            <div className="ac-card"><SkeletonTable rows={3} /></div>
          ) : pendingParticipants.length === 0 ? (
            <div className="ac-empty" style={{ maxWidth: 480, margin: '40px auto', padding: '36px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✔️</div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--academic-text)', margin: '0 0 6px' }}>All Approved</h3>
              <p style={{ color: 'var(--academic-text-secondary)', fontSize: 13.5, margin: 0, lineHeight: 1.5 }}>
                No participants are currently waiting for registration approval.
              </p>
            </div>
          ) : (
            <div className="ac-card" style={{ padding: 0 }}>
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Registered</th><th></th></tr></thead>
                  <tbody>
                    {pendingParticipants.map((p, i) => (
                      <tr key={p.id}>
                        <td style={{ color: 'var(--academic-text-muted)' }}>{i + 1}</td>
                        <td className="font-medium">{p.name}</td>
                        <td style={{ color: 'var(--academic-text-secondary)' }}>{p.email}</td>
                        <td style={{ color: 'var(--academic-text-secondary)' }}>{p.phone || '-'}</td>
                        <td style={{ color: 'var(--academic-text-secondary)' }}>{fmtDate(p.created_at)}</td>
                        <td>
                          <button className="ac-btn ac-btn-sm ac-btn-primary" onClick={() => handleApproveParticipant(p.id)} disabled={loading}>Approve</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── TRAININGS (list) ── */}
      {tab === 'trainings' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Training Sessions')}
            {trainings.length > 0 && (
              <button className="ac-btn ac-btn-primary" onClick={() => handleTabChange('createTraining')}>+ Add Training</button>
            )}
          </div>
          {initialLoading ? (
            <div className="ac-card"><SkeletonTable rows={5} /></div>
          ) : trainings.length === 0 ? (
            <div className="ac-empty" style={{ maxWidth: 480, margin: '40px auto', padding: '36px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--academic-text)', margin: '0 0 6px' }}>No Trainings Yet</h3>
              <p style={{ color: 'var(--academic-text-secondary)', fontSize: 13.5, margin: '0 0 20px', lineHeight: 1.5 }}>
                Create your first training session to schedule classes, assign trainers, and track enrollment.
              </p>
              <button className="ac-btn ac-btn-primary" onClick={() => handleTabChange('createTraining')}>
                + Create Training
              </button>
            </div>
          ) : (
            <div className="ac-card" style={{ padding: 0 }}>
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Title</th><th>Trainer</th><th>Start</th><th>End</th><th>Capacity</th><th>Enrolled</th><th></th></tr>
                  </thead>
                  <tbody>
                    {trainings.map((t, i) => (
                      <tr key={t.id}>
                        <td style={{ color: 'var(--academic-text-muted)' }}>{i + 1}</td>
                        <td className="font-medium">{t.title}</td>
                        <td>{t.trainerName ? <span className="ac-chip ac-chip-primary">{t.trainerName}</span> : <span className="ac-chip">Unassigned</span>}</td>
                        <td style={{ color: 'var(--academic-text-secondary)' }}>{fmtDate(t.startDate)}</td>
                        <td style={{ color: 'var(--academic-text-secondary)' }}>{fmtDate(t.endDate)}</td>
                        <td>{t.capacity ? t.capacity : <span className="ac-chip">∞</span>}</td>
                        <td>{t.enrolledCount ?? 0}</td>
                        <td>
                          <div className="flex gap-1.5 justify-end">
                            <button className="ac-btn ac-btn-sm ac-btn-secondary" onClick={() => openEdit(t)}>Edit</button>
                            <button className="ac-btn ac-btn-sm ac-btn-danger" onClick={() => handleDeleteTraining(t.id, t.title)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── TRAINERS (list) ── */}
      {tab === 'trainers' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Trainers')}
            {trainers.length > 0 && (
              <button className="ac-btn ac-btn-primary" onClick={() => handleTabChange('createTrainer')}>+ Add Trainer</button>
            )}
          </div>
          {initialLoading ? (
            <div className="ac-card"><SkeletonTable rows={5} /></div>
          ) : trainers.length === 0 ? (
            <div className="ac-empty" style={{ maxWidth: 480, margin: '40px auto', padding: '36px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--academic-text)', margin: '0 0 6px' }}>No Trainers Yet</h3>
              <p style={{ color: 'var(--academic-text-secondary)', fontSize: 13.5, margin: '0 0 20px', lineHeight: 1.5 }}>
                Add your first trainer to assign them courses and start tracking performance feedback.
              </p>
              <button className="ac-btn ac-btn-primary" onClick={() => handleTabChange('createTrainer')}>
                + Add First Trainer
              </button>
            </div>
          ) : (
            <div className="ac-card" style={{ padding: '8px 0' }}>
              <TrainerList 
                trainers={trainers}
                token={user.token}
                onDelete={handleDeleteTrainer}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* ── PARTICIPANTS ── */}
      {tab === 'participants' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Participants')}
            {participants.length > 0 && (
              <button className="ac-btn ac-btn-primary" onClick={() => setAddParticipantModal(true)}>+ Add Participant</button>
            )}
          </div>
          {initialLoading ? (
            <div className="ac-card"><SkeletonTable rows={5} /></div>
          ) : participants.length === 0 ? (
            <div className="ac-empty" style={{ maxWidth: 480, margin: '40px auto', padding: '36px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--academic-text)', margin: '0 0 6px' }}>No Participants Yet</h3>
              <p style={{ color: 'var(--academic-text-secondary)', fontSize: 13.5, margin: '0 0 20px', lineHeight: 1.5 }}>
                Enrolled students and participants will appear here. Add your first participant to get started.
              </p>
              <button className="ac-btn ac-btn-primary" onClick={() => setAddParticipantModal(true)}>
                + Add First Participant
              </button>
            </div>
          ) : (
            <div className="ac-card">
              <ParticipantList 
                participants={participants}
                loading={false}
                onDelete={handleDeleteParticipant}
                onRefresh={() => fetchParticipants()}
                onView={(p) => setViewingParticipant(p)}
                onApprove={async (id) => {
                  const r = await fetch(`${API_BASE}/admin/approve-participant/${id}`, { method: 'POST', headers: auth() })
                  if (r.ok) {
                    success('Participant approved successfully')
                    fetchParticipants()
                  } else {
                    const d = await r.json()
                    showError(d.error || 'Failed to approve participant')
                  }
                }}
                onReject={async (id) => {
                  const r = await fetch(`${API_BASE}/admin/reject-participant/${id}`, { method: 'POST', headers: auth() })
                  if (r.ok) {
                    success('Participant rejected successfully')
                    fetchParticipants()
                  } else {
                    const d = await r.json()
                    showError(d.error || 'Failed to reject participant')
                  }
                }}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* ── ASSESSMENT SESSIONS ── */}
      {tab === 'sessions' && (
        <motion.div variants={itemVariants}>
          <AssessmentSessionsPanel />
        </motion.div>
      )}

      {/* ── SURVEYS ── */}
      {tab === 'surveys' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Survey Questions')}
          </div>
          <div className="ac-grid-2">
            <div className="ac-card">
              <h3 className="ac-section-title" style={{ fontSize: 17, marginBottom: 16 }}>Add Question</h3>
              <form onSubmit={handleCreateQuestion}>
                <div className="form-group">
                  <AnimatedDropdown
                    label="Training (Optional)"
                    options={[
                      { value: '', label: 'Apply to ALL Trainings' },
                      ...trainings.map(t => ({ value: t.id, label: t.title }))
                    ]}
                    value={questionForm.trainingId}
                    onChange={(val) => setQuestionForm(p => ({ ...p, trainingId: val }))}
                  />
                </div>
                <div className="form-group">
                  <AnimatedDropdown
                    label="Question Type"
                    options={[
                      { value: 'TEXT', label: 'Text Answer' },
                      { value: 'RATING', label: 'Rating (1-5)' },
                      { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' }
                    ]}
                    value={questionForm.questionType}
                    onChange={(val) => setQuestionForm(p => ({ ...p, questionType: val }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Question Text</label>
                  <input className="form-control" type="text" value={questionForm.questionText} required onChange={e => setQuestionForm(p => ({ ...p, questionText: e.target.value }))} placeholder="Enter survey question" />
                </div>
                {questionForm.questionType === 'MULTIPLE_CHOICE' && (
                  <div className="form-group">
                    <label className="form-label">Options (comma separated)</label>
                    <input className="form-control" type="text" value={questionForm.options} placeholder="Option A, Option B, Option C" required onChange={e => setQuestionForm(p => ({ ...p, options: e.target.value }))} />
                  </div>
                )}
                <button type="submit" className="ac-btn ac-btn-primary" style={{ marginTop: 8 }} disabled={loading}>Add Question</button>
              </form>
            </div>
            <div className="ac-card" style={{ padding: 0 }}>
              <div style={{ padding: '24px 24px 0', border: 'none', margin: 0 }}>
                <h3 className="ac-section-title" style={{ fontSize: 17 }}>Questions ({questions.length})</h3>
              </div>
              {questions.length === 0 ? (
                <div className="ac-empty">
                  <p style={{ color: 'var(--academic-text-muted)' }}>No custom questions added.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead><tr><th>Target</th><th>Question</th><th>Type</th><th>Options</th><th></th></tr></thead>
                    <tbody>
                      {questions.map(q => {
                        const trg = q.trainingId ? trainings.find(t => t.id === q.trainingId)?.title || 'Specific' : 'Global'
                        return (
                          <tr key={q.id}>
                            <td><span className={q.trainingId ? "ac-chip ac-chip-primary" : "ac-chip"}>{trg}</span></td>
                            <td>{q.questionText}</td>
                            <td style={{ color: 'var(--academic-text-secondary)' }}>{q.questionType}</td>
                            <td style={{ color: 'var(--academic-text-secondary)' }}>{q.options ? q.options.join(', ') : '-'}</td>
                            <td><button className="ac-btn ac-btn-sm ac-btn-danger" onClick={() => handleDeleteQuestion(q.id)}>Delete</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── NOTES MANAGEMENT ── */}
      {tab === 'notes' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Notes Management')}
            <div className="flex gap-2">
              {[
                { key: '', label: 'All', count: notes.length },
                { key: 'pending', label: 'Pending', count: notes.filter(n => n.status?.toLowerCase() === 'pending').length },
                { key: 'approved', label: 'Approved', count: notes.filter(n => n.status?.toLowerCase() === 'approved').length }
              ].map(btn => (
                <button
                  key={btn.key}
                  onClick={() => { setNoteFilter(btn.key); fetchNotes(btn.key) }}
                  className={`ac-chip${noteFilter === btn.key ? ' ac-chip-primary' : ''}`}
                  style={{ cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {btn.label} ({btn.count})
                </button>
              ))}
            </div>
          </div>
          {notes.length === 0 ? (
            <div className="ac-card ac-empty">
              <p style={{ color: 'var(--academic-text-muted)' }}>
                {noteFilter === 'pending' ? 'All pending notes have been reviewed.' : 
                 noteFilter === 'approved' ? 'No approved notes yet.' : 
                 'Notes will appear here when trainers upload them.'}
              </p>
            </div>
          ) : (
            <div className="ac-stack-sm">
              {notes.map((note, idx) => {
                const isPending = note.status?.toUpperCase() === 'PENDING'
                const isApproved = note.status?.toUpperCase() === 'APPROVED'
                return (
                  <div key={note.id || idx} className="ac-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`ac-chip ${isApproved ? 'ac-chip-success' : isPending ? 'ac-chip-warning' : 'ac-chip-danger'}`}>{note.status}</span>
                          <span style={{ fontSize: 12, color: 'var(--academic-text-muted)' }}>{fmtDate(note.created_at)}</span>
                        </div>
                        <h4 style={{ fontWeight: 600, fontSize: 15, color: 'var(--academic-text)', fontFamily: "'Poppins', sans-serif" }}>{note.title}</h4>
                        <p style={{ fontSize: 13, color: 'var(--academic-text-muted)', marginTop: 2 }}>{note.trainer?.name || 'Unknown'}</p>
                        <p style={{ fontSize: 14, color: 'var(--academic-text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{note.content}</p>
                      </div>
                      {isPending && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button className="ac-btn ac-btn-sm ac-btn-danger" onClick={() => handleRejectNote(note.id)} disabled={loading}>Reject</button>
                          <button className="ac-btn ac-btn-sm ac-btn-primary" onClick={() => handleApproveNote(note.id)} disabled={loading}>Approve</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── FEEDBACK REPORTS ── */}
      {tab === 'feedback' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Feedback Reports')}
          </div>
          <div className="ov-stat-grid" style={{ marginBottom: 24 }}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3 }}
              className="ov-stat"
            >
              <div className="ov-stat__head">
                <span className="ov-stat__label">Total Responses</span>
                <span className="ov-stat__icon" aria-hidden style={{ background: 'var(--academic-primary-50)', color: 'var(--academic-primary-600)' }}>
                  <MessageSquare size={14} strokeWidth={2} />
                </span>
              </div>
              <div className="ov-stat__value mono">{feedbacks.length}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3 }}
              className="ov-stat"
            >
              <div className="ov-stat__head">
                <span className="ov-stat__label">Avg Trainer Rating</span>
                <span className="ov-stat__icon" aria-hidden style={{ background: 'var(--academic-accent-50)', color: 'var(--academic-accent-500)' }}>
                  <Star size={14} strokeWidth={2} />
                </span>
              </div>
              <div className="ov-stat__value mono">{stats.avgTrainerRating ?? '0.0'}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3 }}
              className="ov-stat"
            >
              <div className="ov-stat__head">
                <span className="ov-stat__label">Avg Subject Rating</span>
                <span className="ov-stat__icon" aria-hidden style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
                  <TrendingUp size={14} strokeWidth={2} />
                </span>
              </div>
              <div className="ov-stat__value mono">{stats.avgSubjectRating ?? '0.0'}</div>
            </motion.div>
          </div>
          <div className="ac-card" style={{ padding: 0 }}>
            {initialLoading ? (
              <SkeletonTable rows={5} />
            ) : feedbacks.length === 0 ? (
              <div className="ac-empty">
                <p style={{ color: 'var(--academic-text-muted)' }}>No feedback submitted yet.</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Training</th><th>Trainer</th><th>Participant</th><th>Trainer Rating</th><th>Subject Rating</th><th>Comments</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {feedbacks.map((f, i) => (
                      <tr key={f.id}>
                        <td style={{ color: 'var(--academic-text-muted)' }}>{i + 1}</td>
                        <td className="font-medium">{f.trainingTitle}</td>
                        <td style={{ color: 'var(--academic-text-secondary)' }}>{f.trainerName}</td>
                        <td>{f.anonymous ? <span className="ac-chip">Anonymous</span> : f.participantName}</td>
                        <td><Stars v={f.trainerRating} /> <span className="text-xs" style={{ color: 'var(--academic-text-muted)', marginLeft: 4 }}>{f.trainerRating}/5</span></td>
                        <td><Stars v={f.subjectRating} /> <span className="text-xs" style={{ color: 'var(--academic-text-muted)', marginLeft: 4 }}>{f.subjectRating}/5</span></td>
                        <td style={{ maxWidth: 150, color: 'var(--academic-text-secondary)', fontSize: 13 }}>{f.comments || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--academic-text-secondary)' }}>{fmtDate(f.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── CREATE TRAINER (two-column layout) ── */}
      {tab === 'createTrainer' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Create Trainer')}
            <button className="ac-btn ac-btn-secondary" onClick={() => handleTabChange('trainers')}>← Back to Trainers</button>
          </div>
          <div className="ac-grid-2">
            <div className="ac-card">
              <h3 className="ac-section-title" style={{ fontSize: 17, marginBottom: 16 }}>Create Trainer Account</h3>
              <form onSubmit={handleCreateTrainer}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-control" type="text" value={trainerForm.name}
                    onChange={e => setTrainerForm(p => ({ ...p, name: e.target.value }))} required placeholder="Trainer full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-control" type="email" value={trainerForm.email}
                    onChange={e => setTrainerForm(p => ({ ...p, email: e.target.value }))} required placeholder="trainer@company.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-control" type="password" value={trainerForm.password}
                    onChange={e => setTrainerForm(p => ({ ...p, password: e.target.value }))} required placeholder="Set password for trainer" />
                </div>
                <button type="submit" className="ac-btn ac-btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Trainer'}
                </button>
              </form>
            </div>
            <div className="ac-card">
              <h3 className="ac-section-title" style={{ fontSize: 17, marginBottom: 16 }}>Trainers ({trainers.length})</h3>
              <TrainerList
                trainers={trainers}
                token={user.token}
                onDelete={handleDeleteTrainer}
                onAddTrainer={() => handleTabChange('createTrainer')}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* ── CREATE TRAINING (two-column layout) ── */}
      {tab === 'createTraining' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Create Training')}
            <button className="ac-btn ac-btn-secondary" onClick={() => handleTabChange('trainings')}>← Back to Trainings</button>
          </div>
          <div className="ac-grid-2">
            <div className="ac-card">
              <h3 className="ac-section-title" style={{ fontSize: 17, marginBottom: 16 }}>Create Training Session</h3>
              <form onSubmit={handleCreateTraining}>
                <div className="form-group">
                  <label className="form-label">Training Title</label>
                  <input className="form-control" type="text" value={trainingForm.title}
                    onChange={e => setTrainingForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. React Fundamentals" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={trainingForm.description}
                    onChange={e => setTrainingForm(p => ({ ...p, description: e.target.value }))} placeholder="Training objectives and content overview..." />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, color: 'var(--academic-text)' }}>Assign Trainer(s)</label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '10px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid var(--academic-border)',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    marginTop: '6px'
                  }}>
                    {trainers.map(t => {
                      const isChecked = trainingForm.trainerIds?.includes(t.id);
                      return (
                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--academic-text)', padding: '6px', borderRadius: '4px', background: isChecked ? 'rgba(255, 255, 255, 0.07)' : 'transparent', transition: 'background 0.2s' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...(trainingForm.trainerIds || []), t.id]
                                : (trainingForm.trainerIds || []).filter(id => id !== t.id);
                              setTrainingForm(p => ({
                                ...p,
                                trainerIds: updated,
                                trainerId: updated[0] || ''
                              }));
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <div>
                            <span style={{ fontWeight: 550 }}>{t.name}</span>
                            <div style={{ fontSize: '11px', color: 'var(--academic-text-muted)' }}>{t.email}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', marginBottom: '16px' }}>
                  <input
                    type="checkbox"
                    id="sequentialLearning"
                    checked={trainingForm.sequentialLearning || false}
                    onChange={e => setTrainingForm(p => ({ ...p, sequentialLearning: e.target.checked }))}
                    style={{ width: 'auto', height: 'auto', cursor: 'pointer', margin: 0 }}
                  />
                  <label htmlFor="sequentialLearning" style={{ fontSize: '13px', fontWeight: 550, color: 'var(--academic-text)', cursor: 'pointer', margin: 0 }}>
                    Enable Sequential Learning Lock
                  </label>
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date &amp; Time</label>
                    <input className="form-control" type="datetime-local" value={trainingForm.startDate}
                      onChange={e => setTrainingForm(p => ({ ...p, startDate: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date &amp; Time</label>
                    <input className="form-control" type="datetime-local" value={trainingForm.endDate}
                      onChange={e => setTrainingForm(p => ({ ...p, endDate: e.target.value }))} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity (blank for unlimited)</label>
                  <input className="form-control" type="number" value={trainingForm.capacity}
                    onChange={e => setTrainingForm(p => ({ ...p, capacity: e.target.value }))} placeholder="e.g. 30" min="1" />
                </div>
                <button type="submit" className="ac-btn ac-btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Training Session'}
                </button>
              </form>
            </div>
            <div className="ac-card" style={{ padding: 0 }}>
              <div style={{ padding: '24px 24px 0', border: 'none', margin: 0 }}>
                <h3 className="ac-section-title" style={{ fontSize: 17 }}>Recent Trainings</h3>
              </div>
              {trainings.length === 0 ? (
                <div className="ac-empty">
                  <p style={{ color: 'var(--academic-text-muted)' }}>No training sessions created yet.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr><th>Title</th><th>Trainer</th><th>Start</th><th>End</th><th></th></tr>
                    </thead>
                    <tbody>
                      {trainings.slice(0, 10).map(t => (
                        <tr key={t.id}>
                          <td className="font-medium">{t.title}</td>
                          <td>{t.trainerName ? <span className="ac-chip ac-chip-primary">{t.trainerName}</span> : <span className="ac-chip">Unassigned</span>}</td>
                          <td style={{ color: 'var(--academic-text-secondary)' }}>{fmtDate(t.startDate)}</td>
                          <td style={{ color: 'var(--academic-text-secondary)' }}>{fmtDate(t.endDate)}</td>
                          <td>
                            <div className="flex gap-1.5 justify-end">
                              <button className="ac-btn ac-btn-sm ac-btn-secondary" onClick={() => openEdit(t)}>Edit</button>
                              <button className="ac-btn ac-btn-sm ac-btn-danger" onClick={() => handleDeleteTraining(t.id, t.title)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── PROGRAMS & COURSES (two-column layout) ── */}
      {tab === 'programs' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Programs & Courses')}
          </div>
          <div className="ac-grid-2" style={{ marginBottom: 24 }}>
            <div className="ac-card">
              <h3 className="ac-section-title" style={{ fontSize: 17, marginBottom: 16 }}>Create Program</h3>
              <form onSubmit={handleCreateProgram}>
                <div className="form-group">
                  <label className="form-label">Program Title</label>
                  <input className="form-control" type="text" value={programForm.title}
                    onChange={e => setProgramForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. Full Stack Development" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={programForm.description}
                    onChange={e => setProgramForm(p => ({ ...p, description: e.target.value }))} placeholder="Program overview..." />
                </div>
                <button type="submit" className="ac-btn ac-btn-primary" disabled={loading}>Create Program</button>
              </form>
            </div>
            <div className="ac-card" style={{ padding: 0 }}>
              <div style={{ padding: '24px 24px 0', border: 'none', margin: 0 }}>
                <h3 className="ac-section-title" style={{ fontSize: 17 }}>Programs ({programs.length})</h3>
              </div>
              {programs.length === 0 ? (
                <div className="ac-empty">
                  <p style={{ color: 'var(--academic-text-muted)' }}>No programs created yet.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead><tr><th>Title</th><th>Description</th><th>Courses</th><th></th></tr></thead>
                    <tbody>
                      {programs.map(p => (
                        <tr key={p.id}>
                          <td className="font-medium">{p.title}</td>
                          <td style={{ color: 'var(--academic-text-secondary)', maxWidth: 200 }} className="text-sm">{(p.description || '').slice(0, 60)}</td>
                          <td>{p.courseCount ?? 0}</td>
                          <td><button className="ac-btn ac-btn-sm ac-btn-danger" onClick={() => handleDeleteProgram(p.id, p.title)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="ac-grid-2">
            <div className="ac-card">
              <h3 className="ac-section-title" style={{ fontSize: 17, marginBottom: 16 }}>Create Course</h3>
              <form onSubmit={handleCreateCourse}>
                <div className="form-group">
                  <label className="form-label">Course Title</label>
                  <input className="form-control" type="text" value={courseForm.title}
                    onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. React for Beginners" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={courseForm.description}
                    onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} placeholder="Course description..." />
                </div>
                <div className="form-group">
                  <AnimatedDropdown
                    label="Program"
                    options={[
                      ...programs.map(p => ({ value: p.id, label: p.title }))
                    ]}
                    value={courseForm.programId}
                    onChange={(val) => setCourseForm(p => ({ ...p, programId: val }))}
                  />
                </div>
                <div className="form-group">
                  <AnimatedDropdown
                    label="Assign Trainer"
                    options={[
                      { value: '', label: 'Select a trainer' },
                      ...trainers.map(t => ({ value: t.id, label: `${t.name} (${t.email})` }))
                    ]}
                    value={courseForm.trainerId}
                    onChange={(val) => setCourseForm(p => ({ ...p, trainerId: val }))}
                  />
                </div>
                <button type="submit" className="ac-btn ac-btn-primary" disabled={loading}>Create Course</button>
              </form>
            </div>
            <div className="ac-card" style={{ padding: 0 }}>
              <div style={{ padding: '24px 24px 0', border: 'none', margin: 0 }}>
                <h3 className="ac-section-title" style={{ fontSize: 17 }}>Courses ({courses.length})</h3>
              </div>
              {courses.length === 0 ? (
                <div className="ac-empty">
                  <p style={{ color: 'var(--academic-text-muted)' }}>No courses created yet.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead><tr><th>Title</th><th>Program</th><th>Trainer</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {courses.map(c => (
                        <tr key={c.id}>
                          <td className="font-medium">{c.title}</td>
                          <td style={{ color: 'var(--academic-text-secondary)' }}>{c.programTitle || '-'}</td>
                          <td style={{ color: 'var(--academic-text-secondary)' }}>{c.trainerName || 'Unassigned'}</td>
                          <td><span className={`ac-chip ${c.status === 'ACTIVE' ? 'ac-chip-success' : 'ac-chip'}`} style={{ fontWeight: 600 }}>{c.status || 'ACTIVE'}</span></td>
                          <td><button className="ac-btn ac-btn-sm ac-btn-danger" onClick={() => handleDeleteCourse(c.id, c.title)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── REPORTS & ANALYTICS ── */}
      {tab === 'reports' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
            {pageTitle('Reports & Analytics')}
            <button className="ac-btn ac-btn-secondary" onClick={fetchAdminReport}>Refresh Report</button>
          </div>

          {!adminReport ? (
            <div className="ac-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <div className="loader" style={{ fontSize: 14, color: 'var(--academic-text-muted)' }}>Loading reports data...</div>
            </div>
          ) : (
            <div>
              {/* Metrics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 20,
                marginBottom: 24
              }}>
                <div className="ac-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--academic-text-muted)', fontWeight: 550, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Users</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--academic-text)', margin: '8px 0 4px', fontFamily: "'Poppins', sans-serif" }}>{adminReport.totalUsers}</div>
                  <div style={{ fontSize: 12, color: 'var(--academic-text-secondary)' }}>
                    Admins: {adminReport.usersByRole?.admin || 0} | Trainers: {adminReport.usersByRole?.trainer || 0} | Participants: {adminReport.usersByRole?.participant || 0}
                  </div>
                </div>

                <div className="ac-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--academic-text-muted)', fontWeight: 550, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trainings &amp; Lessons</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--academic-text)', margin: '8px 0 4px', fontFamily: "'Poppins', sans-serif" }}>
                    {adminReport.totalTrainings} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--academic-text-muted)' }}>Trainings</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--academic-text-secondary)' }}>
                    Total Lessons: {adminReport.totalLessons || 0}
                  </div>
                </div>

                <div className="ac-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--academic-text-muted)', fontWeight: 550, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completion Rate</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--academic-primary)', margin: '8px 0 4px', fontFamily: "'Poppins', sans-serif" }}>
                    {adminReport.completionRate}%
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${adminReport.completionRate}%`, height: '100%', background: 'var(--academic-primary)' }}></div>
                  </div>
                </div>

                <div className="ac-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--academic-text-muted)', fontWeight: 550, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Users (30 Days)</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--academic-text)', margin: '8px 0 4px', fontFamily: "'Poppins', sans-serif" }}>{adminReport.activeUsers}</div>
                  <div style={{ fontSize: 12, color: 'var(--academic-text-secondary)' }}>
                    Enrollment Rate: {adminReport.enrollmentRate}%
                  </div>
                </div>
              </div>

              {/* Trainer Performance */}
              <div className="ac-card" style={{ padding: 24 }}>
                <h3 className="ac-section-title" style={{ fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Trainer Performance &amp; Feedback</span>
                </h3>
                {(!adminReport.trainerPerformance || adminReport.trainerPerformance.length === 0) ? (
                  <div className="ac-empty">
                    <p style={{ color: 'var(--academic-text-muted)' }}>No feedback data available for trainers yet.</p>
                  </div>
                ) : (
                  <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Trainer Name</th>
                          <th style={{ textAlign: 'center' }}>Avg Trainer Rating</th>
                          <th style={{ textAlign: 'center' }}>Avg Subject Rating</th>
                          <th style={{ textAlign: 'center' }}>Feedback Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminReport.trainerPerformance.map(tp => (
                          <tr key={tp.trainerId}>
                            <td className="font-medium" style={{ color: 'var(--academic-text)' }}>{tp.trainerName}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="ac-chip ac-chip-success" style={{ fontWeight: 600 }}>
                                {tp.avgTrainerRating} / 5.0
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="ac-chip ac-chip-primary" style={{ fontWeight: 600 }}>
                                {tp.avgSubjectRating} / 5.0
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--academic-text-secondary)' }}>
                              {tp.feedbackCount} response(s)
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

      {/* ── EDIT MODAL ── */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Training Session</h3>
              <button className="modal-close" onClick={() => setEditModal(null)}>&#10005;</button>
            </div>
            <form onSubmit={handleUpdateTraining}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-control" type="text" value={editForm.title}
                  onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, color: 'var(--academic-text)' }}>Assign Trainer(s)</label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '10px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid var(--academic-border)',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  marginTop: '6px'
                }}>
                  {trainers.map(t => {
                    const isChecked = editForm.trainerIds?.includes(t.id);
                    return (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--academic-text)', padding: '6px', borderRadius: '4px', background: isChecked ? 'rgba(255, 255, 255, 0.07)' : 'transparent', transition: 'background 0.2s' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...(editForm.trainerIds || []), t.id]
                              : (editForm.trainerIds || []).filter(id => id !== t.id);
                            setEditForm(p => ({
                              ...p,
                              trainerIds: updated,
                              trainerId: updated[0] || ''
                            }));
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontWeight: 550 }}>{t.name}</span>
                          <div style={{ fontSize: '11px', color: 'var(--academic-text-muted)' }}>{t.email}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  id="editSequentialLearning"
                  checked={editForm.sequentialLearning || false}
                  onChange={e => setEditForm(p => ({ ...p, sequentialLearning: e.target.checked }))}
                  style={{ width: 'auto', height: 'auto', cursor: 'pointer', margin: 0 }}
                />
                <label htmlFor="editSequentialLearning" style={{ fontSize: '13px', fontWeight: 550, color: 'var(--academic-text)', cursor: 'pointer', margin: 0 }}>
                  Enable Sequential Learning Lock
                </label>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input className="form-control" type="datetime-local" value={editForm.startDate}
                    onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input className="form-control" type="datetime-local" value={editForm.endDate}
                    onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
               <label className="form-label">Capacity</label>
                <input className="form-control" type="number" value={editForm.capacity}
                  onChange={e => setEditForm(p => ({ ...p, capacity: e.target.value }))} placeholder="Unlimited" min="1" />
              </div>
              <div className="modal-footer">
                <button type="button" className="ac-btn ac-btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="ac-btn ac-btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL ── */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
              <button type="button" className="modal-close" onClick={() => setConfirmModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {confirmModal.subtitle && <p style={{ fontSize: 14, color: 'var(--academic-text-secondary)', marginBottom: 16 }}>{confirmModal.subtitle}</p>}
              <div className="modal-footer">
                <button type="button" className="ac-btn ac-btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button type="button" className="ac-btn ac-btn-danger" onClick={confirmAction} disabled={loading}>
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD PARTICIPANT MODAL ── */}
      {addParticipantModal && (
        <div className="modal-overlay" onClick={() => setAddParticipantModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Add New Participant</h3>
              <button className="modal-close" onClick={() => setAddParticipantModal(false)}>&#10005;</button>
            </div>
            <form onSubmit={handleCreateParticipant}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" type="text" value={participantForm.name}
                  onChange={e => setParticipantForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-control" type="email" value={participantForm.email}
                  onChange={e => setParticipantForm(p => ({ ...p, email: e.target.value }))} required placeholder="e.g. john@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-control" type="tel" value={participantForm.phone}
                  onChange={e => setParticipantForm(p => ({ ...p, phone: e.target.value }))} required placeholder="e.g. +91 9876543210" />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-control" type="password" value={participantForm.password}
                  onChange={e => setParticipantForm(p => ({ ...p, password: e.target.value }))} required placeholder="Min 6 characters" minLength="6" />
              </div>
              <div className="modal-footer" style={{ marginTop: 24 }}>
                <button type="button" className="ac-btn ac-btn-secondary" onClick={() => setAddParticipantModal(false)}>Cancel</button>
                <button type="submit" className="ac-btn ac-btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Participant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ParticipantProfileView
        open={!!viewingParticipant}
        userId={viewingParticipant?.id}
        fallback={viewingParticipant ? {
          name: viewingParticipant.name,
          email: viewingParticipant.email,
          createdAt: viewingParticipant.created_at || viewingParticipant.joinedAt,
        } : null}
        onClose={() => setViewingParticipant(null)}
      />
    </motion.div>
  )
}

export default AdminDashboard
