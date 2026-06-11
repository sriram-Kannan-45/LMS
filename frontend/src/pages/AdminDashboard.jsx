import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import TrainerList from '../components/TrainerList'
import ParticipantList from '../components/ParticipantList'
import ParticipantProfileView from '../components/shared/ParticipantProfileView'
import AssessmentSessionsPanel from '../components/admin/AssessmentSessionsPanel'
import AnimatedDropdown from '../components/AnimatedDropdown'
import { useToast } from '../components/Toast'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import Skeleton, { SkeletonStats, SkeletonTable } from '../components/Skeleton'
import { API, API_BASE } from '../api/api'
import { Loader2, TrendingUp, Users, BookOpen, MessageSquare, Star, Award, UserCheck, Activity } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

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

const statCardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }
  })
}

const statIcons = {
  trainings: <BookOpen size={20} />,
  trainers: <Users size={20} />,
  participants: <UserCheck size={20} />,
  enrollments: <Activity size={20} />,
  feedbacks: <MessageSquare size={20} />,
  rating: <Star size={20} />,
  topTrainer: <Award size={20} />,
  satisfaction: <TrendingUp size={20} />,
}

const statColors = {
  trainings: { bg: 'rgba(124,58,237,0.10)', text: '#7C3AED' },
  trainers: { bg: 'rgba(6,182,212,0.10)', text: '#0891B2' },
  participants: { bg: 'rgba(16,185,129,0.10)', text: '#059669' },
  enrollments: { bg: 'rgba(245,158,11,0.10)', text: '#D97706' },
  feedbacks: { bg: 'rgba(139,92,246,0.10)', text: '#8B5CF6' },
  rating: { bg: 'rgba(236,72,153,0.10)', text: '#DB2777' },
  topTrainer: { bg: 'rgba(251,146,60,0.10)', text: '#EA580C' },
  satisfaction: { bg: 'rgba(34,211,238,0.10)', text: '#0891B2' },
}

function StatCard({ label, value, icon, color, index = 0 }) {
  return (
    <motion.div
      className="stat-card"
      variants={statCardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{ scale: 1.02, y: -2 }}
      style={{ minHeight: 140, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="stat-label">{label}</span>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: color?.bg || 'rgba(124,58,237,0.10)',
          color: color?.text || '#7C3AED',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          {icon}
        </div>
      </div>
      <div className="stat-value">{value}</div>
    </motion.div>
  )
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

  const [trainerForm, setTrainerForm] = useState({ name: '', email: '', password: '' })
  const [trainingForm, setTrainingForm] = useState({ title: '', description: '', trainerId: '', startDate: '', endDate: '', capacity: '' })
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
      fetchCourses()
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
      const r = await fetch(`${API_BASE}/admin/trainings`, {
        method: 'POST', headers: auth(),
        body: JSON.stringify({ ...trainingForm, trainerId: parseInt(trainingForm.trainerId), capacity: trainingForm.capacity ? parseInt(trainingForm.capacity) : null })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setTrainingForm({ title: '', description: '', trainerId: '', startDate: '', endDate: '', capacity: '' })
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
      startDate: t.startDate ? t.startDate.slice(0, 16) : '',
      endDate: t.endDate ? t.endDate.slice(0, 16) : '',
      capacity: t.capacity || ''
    })
  }

  const handleUpdateTraining = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/admin/trainings/${editModal.id}`, {
        method: 'PUT', headers: auth(),
        body: JSON.stringify({ ...editForm, trainerId: editForm.trainerId ? parseInt(editForm.trainerId) : undefined })
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
  ]

  const getChartData = () => {
    const trainingGroups = {}
    feedbacks.forEach(f => {
      if (!trainingGroups[f.trainingTitle]) {
        trainingGroups[f.trainingTitle] = { tr: 0, sr: 0, count: 0 }
      }
      trainingGroups[f.trainingTitle].tr += f.trainerRating
      trainingGroups[f.trainingTitle].sr += f.subjectRating
      trainingGroups[f.trainingTitle].count++
    })
    const labels = Object.keys(trainingGroups)
    const trData = labels.map(l => (trainingGroups[l].tr / trainingGroups[l].count).toFixed(1))
    const srData = labels.map(l => (trainingGroups[l].sr / trainingGroups[l].count).toFixed(1))
    return {
      labels,
      datasets: [
        { label: 'Avg Trainer Rating', data: trData, backgroundColor: 'rgba(99, 102, 241, 0.6)' },
        { label: 'Avg Subject Rating', data: srData, backgroundColor: 'rgba(139, 92, 246, 0.5)' }
      ]
    }
  }

  const getTopTrainer = () => {
    const trStats = {}
    feedbacks.forEach(f => {
      if (!f.trainerName) return
      if (!trStats[f.trainerName]) trStats[f.trainerName] = { score: 0, count: 0 }
      trStats[f.trainerName].score += f.trainerRating
      trStats[f.trainerName].count++
    })
    let top = { name: '-', avg: 0 }
    Object.entries(trStats).forEach(([name, data]) => {
      const avg = data.score / data.count
      if (avg > top.avg) { top = { name, avg } }
    })
    return top
  }

  const topTrainer = getTopTrainer()

  if (!user || !user.token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#F8F9FC'
      }}>
        <Loader2 style={{ animation: 'spin 1s linear infinite', color: '#7C3AED' }} size={24} />
        <span style={{ marginTop: '12px', fontSize: '13px', color: '#6B7280' }}>Verifying session...</span>
      </div>
    )
  }

  const pageTitle = (title) => (
    <h1 style={{
      fontFamily: "'Outfit', sans-serif",
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      color: '#111827',
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
      {/* Page Title Bar */}
      <motion.div variants={itemVariants} style={{ marginBottom: 32 }}>
        {pageTitle('Dashboard')}
      </motion.div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <motion.div variants={itemVariants}>
          {initialLoading ? (
            <SkeletonStats />
          ) : (
            <motion.div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 24,
                marginBottom: 32
              }}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <StatCard
                label="Total Trainings"
                value={stats.totalTrainings ?? 0}
                icon={statIcons.trainings}
                color={statColors.trainings}
                index={0}
              />
              <StatCard
                label="Trainers"
                value={stats.totalTrainers ?? 0}
                icon={statIcons.trainers}
                color={statColors.trainers}
                index={1}
              />
              <StatCard
                label="Participants"
                value={stats.totalParticipants ?? 0}
                icon={statIcons.participants}
                color={statColors.participants}
                index={2}
              />
              <StatCard
                label="Active Enrollments"
                value={stats.totalEnrollments ?? 0}
                icon={statIcons.enrollments}
                color={statColors.enrollments}
                index={3}
              />
              <StatCard
                label="Feedback Responses"
                value={stats.totalFeedbacks ?? 0}
                icon={statIcons.feedbacks}
                color={statColors.feedbacks}
                index={4}
              />
              <StatCard
                label="Avg Trainer Rating"
                value={`${stats.avgTrainerRating ?? '0.0'}`}
                icon={statIcons.rating}
                color={statColors.rating}
                index={5}
              />
              <StatCard
                label="Top Trainer"
                value={topTrainer.name}
                icon={statIcons.topTrainer}
                color={statColors.topTrainer}
                index={6}
              />
              <StatCard
                label="Satisfaction Score"
                value={`${stats.satisfactionScore ?? '0.0'}`}
                icon={statIcons.satisfaction}
                color={statColors.satisfaction}
                index={7}
              />
            </motion.div>
          )}
          <motion.div variants={itemVariants} className="card" style={{ padding: 28 }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 20, letterSpacing: '-0.02em' }}>Feedback Trends</h3>
            {feedbacks.length > 0 ? (
              <div style={{ height: 280 }}>
                <Bar data={getChartData()} options={{ maintainAspectRatio: false }} />
              </div>
            ) : (
              <div className="empty-state">
                <p style={{ color: 'var(--text-secondary)' }}>Feedback trends will appear once participants start submitting feedback.</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* ── PENDING APPROVAL ── */}
      {tab === 'pending' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Pending Approval')}
          </div>
          <div className="card" style={{ padding: 0 }}>
            {initialLoading ? (
              <SkeletonTable rows={3} />
            ) : pendingParticipants.length === 0 ? (
              <div className="empty-state">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No participants are currently waiting for approval.</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Registered</th><th></th></tr></thead>
                  <tbody>
                    {pendingParticipants.map((p, i) => (
                      <tr key={p.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td className="font-medium">{p.name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.email}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{p.phone || '-'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.created_at)}</td>
                        <td>
                          <button className="btn btn-sm btn-primary" onClick={() => handleApproveParticipant(p.id)} disabled={loading}>Approve</button>
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

      {/* ── TRAININGS (list) ── */}
      {tab === 'trainings' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Training Sessions')}
            <button className="btn btn-primary" onClick={() => handleTabChange('createTraining')}>+ Add Training</button>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {initialLoading ? (
              <SkeletonTable rows={5} />
            ) : trainings.length === 0 ? (
              <div className="empty-state">
                <p style={{ color: 'var(--text-secondary)' }}>No training sessions created yet.</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => handleTabChange('createTraining')}>+ Create Training</button>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr><th>#</th><th>Title</th><th>Trainer</th><th>Start</th><th>End</th><th>Capacity</th><th>Enrolled</th><th></th></tr>
                  </thead>
                  <tbody>
                    {trainings.map((t, i) => (
                      <tr key={t.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td className="font-medium">{t.title}</td>
                        <td>{t.trainerName ? <span className="badge badge-blue">{t.trainerName}</span> : <span className="badge badge-gray">Unassigned</span>}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(t.startDate)}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(t.endDate)}</td>
                        <td>{t.capacity ? t.capacity : <span className="badge badge-gray">∞</span>}</td>
                        <td>{t.enrolledCount ?? 0}</td>
                        <td>
                          <div className="flex gap-1.5 justify-end">
                            <button className="btn btn-sm" onClick={() => openEdit(t)}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteTraining(t.id, t.title)}>Delete</button>
                          </div>
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

      {/* ── TRAINERS (list) ── */}
      {tab === 'trainers' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Trainers')}
            <button className="btn btn-primary" onClick={() => handleTabChange('createTrainer')}>+ Add Trainer</button>
          </div>
          <div className="card">
            <TrainerList 
              trainers={trainers}
              token={user.token}
              onDelete={handleDeleteTrainer}
              onAddTrainer={() => handleTabChange('createTrainer')}
            />
          </div>
        </motion.div>
      )}

      {/* ── PARTICIPANTS ── */}
      {tab === 'participants' && (
        <motion.div variants={itemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Participants')}
            <button className="btn btn-primary" onClick={() => setAddParticipantModal(true)}>+ Add Participant</button>
          </div>
          <div className="card">
            {initialLoading ? (
              <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>Loading participants...</div>
            ) : (
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
            )}
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Survey Questions')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
            <div className="card">
              <div className="card-header"><h3>Add Question</h3></div>
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
                <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={loading}>Add Question</button>
              </form>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: '24px 24px 0', border: 'none', margin: 0 }}>
                <h3>Questions ({questions.length})</h3>
              </div>
              {questions.length === 0 ? (
                <div className="empty-state">
                  <p style={{ color: 'var(--text-secondary)' }}>No custom questions added.</p>
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
                            <td><span className={q.trainingId ? "badge badge-blue" : "badge badge-gray"}>{trg}</span></td>
                            <td>{q.questionText}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{q.questionType}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{q.options ? q.options.join(', ') : '-'}</td>
                            <td><button className="btn btn-sm btn-danger" onClick={() => handleDeleteQuestion(q.id)}>Delete</button></td>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
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
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 16px', fontSize: 13, fontWeight: 600,
                    borderRadius: 9999, border: '1px solid var(--border-default)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 180ms ease',
                    background: noteFilter === btn.key ? 'var(--accent)' : 'transparent',
                    color: noteFilter === btn.key ? '#fff' : 'var(--text-secondary)',
                    borderColor: noteFilter === btn.key ? 'var(--accent)' : 'var(--border-default)'
                  }}
                >
                  {btn.label} ({btn.count})
                </button>
              ))}
            </div>
          </div>
          {notes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
              <p style={{ color: 'var(--text-secondary)' }}>
                {noteFilter === 'pending' ? 'All pending notes have been reviewed.' : 
                 noteFilter === 'approved' ? 'No approved notes yet.' : 
                 'Notes will appear here when trainers upload them.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notes.map((note, idx) => {
                const isPending = note.status?.toUpperCase() === 'PENDING'
                const isApproved = note.status?.toUpperCase() === 'APPROVED'
                return (
                  <div key={note.id || idx} className="card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '3px 10px', fontSize: 11, fontWeight: 600,
                            borderRadius: 9999, border: '1px solid',
                            background: isApproved ? 'rgba(16,185,129,0.08)' : isPending ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                            color: isApproved ? '#059669' : isPending ? '#d97706' : '#dc2626',
                            borderColor: isApproved ? 'rgba(16,185,129,0.15)' : isPending ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'
                          }}>{note.status}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(note.created_at)}</span>
                        </div>
                        <h4 style={{ fontWeight: 600, fontSize: 15, color: '#111827', fontFamily: "'Outfit', sans-serif" }}>{note.title}</h4>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{note.trainer?.name || 'Unknown'}</p>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{note.content}</p>
                      </div>
                      {isPending && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button className="btn btn-sm btn-danger" onClick={() => handleRejectNote(note.id)} disabled={loading}>Reject</button>
                          <button className="btn btn-sm btn-primary" onClick={() => handleApproveNote(note.id)} disabled={loading}>Approve</button>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Feedback Reports')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24, marginBottom: 24 }}>
            <StatCard
              label="Total Responses"
              value={feedbacks.length}
              icon={statIcons.feedbacks}
              color={statColors.feedbacks}
              index={0}
            />
            <StatCard
              label="Avg Trainer Rating"
              value={`${stats.avgTrainerRating ?? '0.0'}`}
              icon={statIcons.rating}
              color={statColors.rating}
              index={1}
            />
            <StatCard
              label="Avg Subject Rating"
              value={`${stats.avgSubjectRating ?? '0.0'}`}
              icon={statIcons.satisfaction}
              color={statColors.satisfaction}
              index={2}
            />
          </div>
          <div className="card" style={{ padding: 0 }}>
            {initialLoading ? (
              <SkeletonTable rows={5} />
            ) : feedbacks.length === 0 ? (
              <div className="empty-state">
                <p style={{ color: 'var(--text-secondary)' }}>No feedback submitted yet.</p>
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
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td className="font-medium">{f.trainingTitle}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{f.trainerName}</td>
                        <td>{f.anonymous ? <span className="badge badge-gray">Anonymous</span> : f.participantName}</td>
                        <td><Stars v={f.trainerRating} /> <span className="text-xs" style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{f.trainerRating}/5</span></td>
                        <td><Stars v={f.subjectRating} /> <span className="text-xs" style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{f.subjectRating}/5</span></td>
                        <td style={{ maxWidth: 150, color: 'var(--text-secondary)', fontSize: 13 }}>{f.comments || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmtDate(f.submittedAt)}</td>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Create Trainer')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
            <div className="card">
              <div className="card-header"><h3>Create Trainer Account</h3></div>
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
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Trainer'}
                </button>
              </form>
            </div>
            <div className="card">
              <div className="card-header"><h3>Trainers ({trainers.length})</h3></div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Create Training')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
            <div className="card">
              <div className="card-header"><h3>Create Training Session</h3></div>
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
                  <AnimatedDropdown
                    label="Assign Trainer"
                    options={[
                      { value: '', label: 'Select a trainer' },
                      ...trainers.map(t => ({ value: t.id, label: `${t.name} (${t.email})` }))
                    ]}
                    value={trainingForm.trainerId}
                    onChange={(val) => setTrainingForm(p => ({ ...p, trainerId: val }))}
                  />
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
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Training Session'}
                </button>
              </form>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: '24px 24px 0', border: 'none', margin: 0 }}>
                <h3>Recent Trainings</h3>
              </div>
              {trainings.length === 0 ? (
                <div className="empty-state">
                  <p style={{ color: 'var(--text-secondary)' }}>No training sessions created yet.</p>
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
                          <td>{t.trainerName ? <span className="badge badge-blue">{t.trainerName}</span> : <span className="badge badge-gray">Unassigned</span>}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(t.startDate)}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(t.endDate)}</td>
                          <td>
                            <div className="flex gap-1.5 justify-end">
                              <button className="btn btn-sm" onClick={() => openEdit(t)}>Edit</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteTraining(t.id, t.title)}>Delete</button>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            {pageTitle('Programs & Courses')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24, marginBottom: 24 }}>
            <div className="card">
              <div className="card-header"><h3>Create Program</h3></div>
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
                <button type="submit" className="btn btn-primary" disabled={loading}>Create Program</button>
              </form>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: '24px 24px 0', border: 'none', margin: 0 }}>
                <h3>Programs ({programs.length})</h3>
              </div>
              {programs.length === 0 ? (
                <div className="empty-state">
                  <p style={{ color: 'var(--text-secondary)' }}>No programs created yet.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead><tr><th>Title</th><th>Description</th><th>Courses</th><th></th></tr></thead>
                    <tbody>
                      {programs.map(p => (
                        <tr key={p.id}>
                          <td className="font-medium">{p.title}</td>
                          <td style={{ color: 'var(--text-secondary)', maxWidth: 200 }} className="text-sm">{(p.description || '').slice(0, 60)}</td>
                          <td>{p.courseCount ?? 0}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => handleDeleteProgram(p.id, p.title)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
            <div className="card">
              <div className="card-header"><h3>Create Course</h3></div>
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
                <button type="submit" className="btn btn-primary" disabled={loading}>Create Course</button>
              </form>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <div className="card-header" style={{ padding: '24px 24px 0', border: 'none', margin: 0 }}>
                <h3>Courses ({courses.length})</h3>
              </div>
              {courses.length === 0 ? (
                <div className="empty-state">
                  <p style={{ color: 'var(--text-secondary)' }}>No courses created yet.</p>
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead><tr><th>Title</th><th>Program</th><th>Trainer</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {courses.map(c => (
                        <tr key={c.id}>
                          <td className="font-medium">{c.title}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{c.programTitle || '-'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{c.trainerName || 'Unassigned'}</td>
                          <td><span className={`badge ${c.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`} style={{ fontWeight: 600 }}>{c.status || 'ACTIVE'}</span></td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => handleDeleteCourse(c.id, c.title)}>Delete</button></td>
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
                <AnimatedDropdown
                  label="Trainer"
                  options={[
                    { value: '', label: 'No trainer assigned' },
                    ...trainers.map(t => ({ value: t.id, label: t.name }))
                  ]}
                  value={editForm.trainerId}
                  onChange={(val) => setEditForm(p => ({ ...p, trainerId: val }))}
                />
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
                <button type="button" className="btn" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
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
              {confirmModal.subtitle && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{confirmModal.subtitle}</p>}
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={confirmAction} disabled={loading}>
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
                <button type="button" className="btn" onClick={() => setAddParticipantModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
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
