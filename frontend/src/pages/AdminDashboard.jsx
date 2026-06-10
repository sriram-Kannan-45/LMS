import { useState, useEffect } from 'react'
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
import { motion, AnimatePresence } from 'framer-motion'
import Skeleton, { SkeletonStats, SkeletonTable } from '../components/Skeleton'
import { API, API_BASE } from '../api/api'
import { BookOpen, Users, GraduationCap, ClipboardList, MessageSquare, Star, Trophy, Award } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'
const initials = (name) => name ? name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'AD'
const Stars = ({ v }) => (
  <span className="stars">
    {[1,2,3,4,5].map(s => <span key={s} className={`star ${s <= v ? 'filled' : ''}`}>&#9733;</span>)}
  </span>
)

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

  // Loading state for initial data fetch
  const [initialLoading, setInitialLoading] = useState(true)

  // Confirmation modals
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
      fetchNotes()
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
      // Handle both { trainers } and { success: true, data: { trainers } }
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
      // Handle both { participants } and { success: true, data: { participants } }
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

  const handleApproveNote = async (noteId) => {
    setLoading(true)
    try {
      // Optimistic update - remove from pending immediately
      const oldNotes = notes
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
      // Revert on error
      await fetchNotes(noteFilter)
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRejectNote = async (noteId) => {
    setLoading(true)
    try {
      // Optimistic update - remove from pending immediately
      const oldNotes = notes
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
      // Revert on error
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

  const TABS_WITH_BUTTONS = [
    { key: 'overview', label: 'Overview' },
    { key: 'pending', label: 'Pending Approval' },
    { key: 'trainings', label: 'Trainings' },
    { key: 'participants', label: 'Participants' },
    { key: 'feedback', label: 'Feedback Reports' },
    { key: 'surveys', label: 'Survey Config' },
  ]

  // Chart Data preparation
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
        { label: 'Avg Trainer Rating', data: trData, backgroundColor: 'rgba(99, 102, 241, 0.7)' },
        { label: 'Avg Subject Rating', data: srData, backgroundColor: 'rgba(168, 85, 247, 0.7)' }
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

  return (
    <AnimatePresence>
      <div className="dashboard">



          {/* OVERVIEW */}
          {tab === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {initialLoading ? (
                <SkeletonStats />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  {/* Card 1: Total Trainings */}
                  <div className="stat-card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="stat-label">Total Trainings</div>
                        <div className="stat-value mt-2">{stats.totalTrainings ?? 0}</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 flex-shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Trainers */}
                  <div className="stat-card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="stat-label">Trainers</div>
                        <div className="stat-value mt-2">{stats.totalTrainers ?? 0}</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 flex-shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Participants */}
                  <div className="stat-card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="stat-label">Participants</div>
                        <div className="stat-value mt-2">{stats.totalParticipants ?? 0}</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 flex-shrink-0">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Active Enrollments */}
                  <div className="stat-card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="stat-label">Active Enrollments</div>
                        <div className="stat-value mt-2">{stats.totalEnrollments ?? 0}</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 flex-shrink-0">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Feedback Responses */}
                  <div className="stat-card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="stat-label">Feedback Responses</div>
                        <div className="stat-value mt-2">{stats.totalFeedbacks ?? 0}</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 flex-shrink-0">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Card 6: Avg Trainer Rating */}
                  <div className="stat-card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="stat-label">Avg Trainer Rating</div>
                        <div className="stat-value mt-2">
                          {stats.avgTrainerRating ?? '0.0'} <span className="text-xs text-slate-400 font-semibold">/ 5</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 flex-shrink-0">
                        <Star className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Card 7: Top Trainer */}
                  <div className="stat-card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="stat-label">Top Trainer</div>
                        <div className="stat-value mt-2 truncate text-lg font-bold" style={{ fontSize: '18px' }}>{topTrainer.name}</div>
                        <div className="text-xs text-slate-500 font-semibold mt-1">Avg: {topTrainer.avg > 0 ? topTrainer.avg.toFixed(1) : '-'}</div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 flex-shrink-0">
                        <Trophy className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Card 8: Overall Satisfaction */}
                  <div className="stat-card p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="stat-label">Satisfaction</div>
                        <div className="stat-value mt-2">
                          {stats.satisfactionScore ?? '0.0'} <span className="text-xs text-slate-400 font-semibold">/ 5</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 flex-shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-white dark:bg-slate-900/30 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm mt-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">Feedback Trends Overview</h3>
                {initialLoading ? (
                  <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Skeleton style={{ width: '100%', height: 250, borderRadius: 12 }} />
                  </div>
                ) : feedbacks.length > 0 ? (
                  <div style={{ height: 300 }}>
                    <Bar data={getChartData()} options={{ maintainAspectRatio: false }} />
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>Not Enough Data</h3>
                    <p>Feedback trends will appear here once participants start submitting feedback.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* PENDING APPROVAL */}
          {tab === 'pending' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="card">
                <div className="card-header">
                  <h3>Pending Participants ({pendingParticipants.length})</h3>
                </div>
                {initialLoading ? (
                  <SkeletonTable rows={3} />
                ) : pendingParticipants.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✓</div>
                    <h3>All Caught Up!</h3>
                    <p>No participants are currently waiting for approval.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Registered</th><th>Actions</th></tr></thead>
                      <tbody>
                        {pendingParticipants.map((p, i) => (
                          <tr key={p.id}>
                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td><strong>{p.name}</strong></td>
                            <td>{p.email}</td>
                            <td>{p.phone || '-'}</td>
                            <td>{fmtDate(p.created_at)}</td>
                            <td>
                              <button className="btn btn-sm btn-success" onClick={() => handleApproveParticipant(p.id)} disabled={loading}>Approve</button>
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

          {/* TRAININGS */}
          {tab === 'trainings' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">All Training Sessions ({trainings.length})</h3>
                  <button className="btn btn-primary btn-sm rounded-xl cursor-pointer" onClick={() => handleTabChange('createTraining')}>+ Add Training</button>
                </div>
                {initialLoading ? (
                  <SkeletonTable rows={5} />
                ) : trainings.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📚</div>
                    <h3>No Training Sessions</h3>
                    <p>Create your first training session to get started.</p>
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => handleTabChange('createTraining')}>+ Create Training</button>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr><th>#</th><th>Title</th><th>Description</th><th>Trainer</th><th>Start Date</th><th>End Date</th><th>Capacity</th><th>Enrolled</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {trainings.map((t, i) => (
                          <tr key={t.id}>
                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td><strong>{t.title}</strong></td>
                            <td style={{ color: 'var(--text-secondary)', maxWidth: 180 }}>{t.description ? t.description.slice(0, 60) + (t.description.length > 60 ? '...' : '') : '-'}</td>
                            <td>{t.trainerName ? <span className="badge badge-purple">{t.trainerName}</span> : <span className="badge badge-gray">Unassigned</span>}</td>
                            <td>{fmtDate(t.startDate)}</td>
                            <td>{fmtDate(t.endDate)}</td>
                            <td>{t.capacity ? t.capacity : <span className="badge badge-blue">Unlimited</span>}</td>
                            <td>{t.enrolledCount ?? 0}</td>
                            <td>
                              <div className="actions">
                                <button className="btn btn-sm btn-success" onClick={() => handleSendReminders(t.id)} disabled={loading}>Remind</button>
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

          {/* TRAINERS */}
          {tab === 'trainers' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Trainers / Instructors ({trainers.length})</h3>
                  <button 
                    className="btn btn-sm btn-primary rounded-xl cursor-pointer"
                    onClick={() => handleTabChange('createTrainer')}
                  >
                    + Add Trainer
                  </button>
                </div>
                <TrainerList 
                  trainers={trainers}
                  token={user.token}
                  onDelete={handleDeleteTrainer}
                  onAddTrainer={() => handleTabChange('createTrainer')}
                />
              </div>
            </motion.div>
          )}

          {/* PARTICIPANTS */}
          {tab === 'participants' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="card">
                <div className="flex items-center justify-between mb-5 border-b border-slate-200/60 dark:border-zinc-800/60 pb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Registered Participants</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 rounded-full">
                      {participants.length} total
                    </span>
                  </div>
                  <button 
                    className="btn btn-primary btn-sm rounded-xl cursor-pointer" 
                    onClick={() => setAddParticipantModal(true)}
                  >
                    + Add Participant
                  </button>
                </div>

                {initialLoading ? (
                  <div className="empty-state">
                    <div className="empty-icon">⏳</div>
                    <p>Loading participants...</p>
                  </div>
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

          {/* ASSESSMENT SESSIONS */}
          {tab === 'sessions' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AssessmentSessionsPanel />
            </motion.div>
          )}

          {/* SURVEYS */}
          {tab === 'surveys' && (
            <div className="card">
              <div className="card-header">
                <h3>Dynamic Feedback Survey Questions</h3>
              </div>
              <form onSubmit={handleCreateQuestion} style={{ marginBottom: 20 }}>
                <div className="form-grid-2">
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
                </div>
                <div className="form-group">
                  <label className="form-label">Question Text</label>
                  <input className="form-control" type="text" value={questionForm.questionText} required onChange={e => setQuestionForm(p => ({ ...p, questionText: e.target.value }))} />
                </div>
                {questionForm.questionType === 'MULTIPLE_CHOICE' && (
                  <div className="form-group">
                    <label className="form-label">Options (Comma separated)</label>
                    <input className="form-control" type="text" value={questionForm.options} placeholder="Option A, Option B, Option C" required onChange={e => setQuestionForm(p => ({ ...p, options: e.target.value }))} />
                  </div>
                )}
                <button type="submit" className="btn btn-primary" disabled={loading}>Add Question</button>
              </form>

              {questions.length === 0 ? (
                <div className="empty-state"><p>No custom questions added.</p></div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead><tr><th>Target</th><th>Question</th><th>Type</th><th>Options</th><th>Actions</th></tr></thead>
                    <tbody>
                      {questions.map(q => {
                        const trg = q.trainingId ? trainings.find(t => t.id === q.trainingId)?.title || 'Specific' : 'Global'
                        return (
                          <tr key={q.id}>
                            <td><span className={q.trainingId ? "badge badge-purple" : "badge badge-blue"}>{trg}</span></td>
                            <td>{q.questionText}</td>
                            <td>{q.questionType}</td>
                            <td>{q.options ? q.options.join(', ') : '-'}</td>
                            <td><button className="btn btn-sm btn-danger" onClick={() => handleDeleteQuestion(q.id)}>Delete</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* NOTES MANAGEMENT */}
          {tab === 'notes' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Header with Filters */}
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>Notes Management</h3>
                  <p className="text-sm text-slate-500" style={{ color: 'var(--text-secondary)' }}>Manage trainer note submissions</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: '', label: 'All', count: notes.length },
                    { key: 'pending', label: 'Pending', count: notes.filter(n => n.status?.toLowerCase() === 'pending').length },
                    { key: 'approved', label: 'Approved', count: notes.filter(n => n.status?.toLowerCase() === 'approved').length }
                  ].map(btn => (
                    <motion.button
                      key={btn.key}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setNoteFilter(btn.key); fetchNotes(btn.key) }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all border ${
                        noteFilter === btn.key
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                          : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                      }`}
                      style={{
                        backgroundColor: noteFilter === btn.key ? 'var(--accent)' : 'var(--bg-surface)',
                        borderColor: noteFilter === btn.key ? 'var(--accent)' : 'var(--border-default)',
                        color: noteFilter === btn.key ? 'var(--text-inverse)' : 'var(--text-secondary)'
                      }}
                    >
                      {btn.label}
                      <span 
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: noteFilter === btn.key ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-subtle)',
                          color: noteFilter === btn.key ? 'var(--text-inverse)' : 'var(--text-primary)'
                        }}
                      >
                        {btn.count}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Notes List */}
              {notes.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card text-center"
                  style={{
                    padding: '80px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed var(--border-default)',
                    background: 'var(--bg-surface)',
                    boxShadow: 'none'
                  }}
                >
                  <div className="text-5xl mb-3">📄</div>
                  <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No notes found</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                    {noteFilter === 'pending' ? 'All pending notes have been reviewed.' : 
                     noteFilter === 'approved' ? 'No approved notes yet.' : 
                     'Notes will appear here when trainers upload them.'}
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note, idx) => {
                    const statusConfig = {
                      'PENDING': { 
                        text: 'var(--warning)', 
                        badgeClass: 'badge badge-yellow', 
                        badge: '⏳' 
                      },
                      'APPROVED': { 
                        text: 'var(--success)', 
                        badgeClass: 'badge badge-green', 
                        badge: '✅' 
                      },
                      'REJECTED': { 
                        text: 'var(--danger)', 
                        badgeClass: 'badge badge-red', 
                        badge: '❌' 
                      }
                    }
                    const config = statusConfig[note.status?.toUpperCase()] || statusConfig['PENDING']
                    
                    return (
                      <motion.div
                        key={note.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ x: 4, boxShadow: 'var(--shadow-md)' }}
                        className="card"
                        style={{
                          borderLeft: `4px solid ${config.text}`,
                          borderColor: `var(--border-default) var(--border-default) var(--border-default) ${config.text}`,
                          padding: '20px'
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={config.badgeClass} style={{ flexShrink: 0 }}>
                                <span className="mr-1">{config.badge}</span>
                                {note.status}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-lg truncate" style={{ margin: 0, color: 'var(--text-primary)' }}>{note.title}</h4>
                                <p className="text-sm mt-1" style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                  {note.trainer?.name || 'Unknown'} • {fmtDate(note.created_at)}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)', margin: 0 }}>{note.content}</p>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {note.status === 'PENDING' && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleRejectNote(note.id)}
                                  disabled={loading}
                                  className="btn btn-sm btn-danger"
                                >
                                  Reject
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleApproveNote(note.id)}
                                  disabled={loading}
                                  className="btn btn-sm btn-success"
                                >
                                  Approve
                                </motion.button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* FEEDBACK REPORTS */}
          {tab === 'feedback' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-label">Total Responses</div>
                  <div className="stat-value">{feedbacks.length}</div>
                </div>
                <div className="stat-card orange">
                  <div className="stat-label">Avg Trainer Rating</div>
                  <div className="stat-value">{stats.avgTrainerRating ?? '0.0'} / 5</div>
                </div>
                <div className="stat-card purple">
                  <div className="stat-label">Avg Subject Rating</div>
                  <div className="stat-value">{stats.avgSubjectRating ?? '0.0'} / 5</div>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <h3>Feedback Analysis &amp; Reports</h3>
                </div>
                {initialLoading ? (
                  <SkeletonTable rows={5} />
                ) : feedbacks.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <h3>No Feedback Yet</h3>
                    <p>Feedback from participants will appear here once they start submitting.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr><th>#</th><th>Training</th><th>Trainer</th><th>Participant</th><th>Trainer Rating</th><th>Subject Rating</th><th>Comments</th><th>Trainer Reply</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {feedbacks.map((f, i) => (
                          <tr key={f.id}>
                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td><strong>{f.trainingTitle}</strong></td>
                            <td>{f.trainerName}</td>
                            <td>{f.anonymous ? <span className="badge badge-gray">Anonymous</span> : f.participantName}</td>
                            <td><Stars v={f.trainerRating} /> <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{f.trainerRating}/5</span></td>
                            <td><Stars v={f.subjectRating} /> <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>{f.subjectRating}/5</span></td>
                            <td style={{ maxWidth: 150, fontSize: 12, color: 'var(--text-secondary)' }}>{f.comments || '-'}</td>
                            <td style={{ maxWidth: 150, fontSize: 12, color: 'var(--text-secondary)' }}>{f.trainerResponse || '-'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(f.submittedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ADD TRAINER */}
          {tab === 'createTrainer' && (
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
                    <label className="form-label">Email Address (Username)</label>
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
                <div className="card-header">
                  <h3>Trainers / Instructors ({trainers.length})</h3>
                </div>
                <TrainerList
                  trainers={trainers}
                  token={user.token}
                  onDelete={handleDeleteTrainer}
                  onAddTrainer={() => handleTabChange('createTrainer')}
                />
              </div>
            </div>
          )}

          {/* ADD TRAINING */}
          {tab === 'createTraining' && (
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
                    <label className="form-label">Participant Capacity (leave blank for unlimited)</label>
                    <input className="form-control" type="number" value={trainingForm.capacity}
                      onChange={e => setTrainingForm(p => ({ ...p, capacity: e.target.value }))} placeholder="e.g. 30" min="1" />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Training Session'}
                  </button>
                </form>
              </div>
              <div className="card">
                <div className="card-header">
                  <h3>All Training Sessions ({trainings.length})</h3>
                </div>
                {trainings.length === 0 ? (
                  <div className="empty-state"><p>No training sessions created yet.</p></div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr><th>#</th><th>Title</th><th>Trainer</th><th>Start</th><th>End</th><th>Capacity</th><th>Enrolled</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {trainings.map((t, i) => (
                          <tr key={t.id}>
                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td><strong>{t.title}</strong></td>
                            <td>{t.trainerName ? <span className="badge badge-purple">{t.trainerName}</span> : <span className="badge badge-gray">Unassigned</span>}</td>
                            <td>{fmtDate(t.startDate)}</td>
                            <td>{fmtDate(t.endDate)}</td>
                            <td>{t.capacity ? t.capacity : <span className="badge badge-blue">Unlimited</span>}</td>
                            <td>{t.enrolledCount ?? 0}</td>
                            <td>
                              <div className="actions">
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
          )}

      {/* EDIT MODAL */}
      {editModal && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
          >
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
          </motion.div>
        </motion.div>
      )}

      {confirmModal && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setConfirmModal(null)}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
              <button type="button" className="modal-close" onClick={() => setConfirmModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {confirmModal.subtitle && <p>{confirmModal.subtitle}</p>}
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={confirmAction} disabled={loading}>
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </motion.div>
          </motion.div>
        )}
      </div>

      {addParticipantModal && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            style={{ maxWidth: '480px' }}
          >
            <div className="modal-header">
              <h3>Add New Participant</h3>
              <button className="modal-close" onClick={() => setAddParticipantModal(false)}>&#10005;</button>
            </div>
            <form onSubmit={handleCreateParticipant}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  className="form-control" 
                  type="text" 
                  value={participantForm.name}
                  onChange={e => setParticipantForm(p => ({ ...p, name: e.target.value }))} 
                  required 
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  className="form-control" 
                  type="email" 
                  value={participantForm.email}
                  onChange={e => setParticipantForm(p => ({ ...p, email: e.target.value }))} 
                  required 
                  placeholder="e.g. john@example.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  className="form-control" 
                  type="tel" 
                  value={participantForm.phone}
                  onChange={e => setParticipantForm(p => ({ ...p, phone: e.target.value }))} 
                  required 
                  placeholder="e.g. +91 9876543210"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  className="form-control" 
                  type="password" 
                  value={participantForm.password}
                  onChange={e => setParticipantForm(p => ({ ...p, password: e.target.value }))} 
                  required 
                  placeholder="Min 6 characters"
                  minLength="6"
                />
              </div>
              <div className="modal-footer mt-6">
                <button type="button" className="btn cursor-pointer" onClick={() => setAddParticipantModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary cursor-pointer" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Participant'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
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
    </AnimatePresence>
  )
}

export default AdminDashboard