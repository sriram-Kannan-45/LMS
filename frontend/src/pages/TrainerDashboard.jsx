import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Users, UserPlus, Star, FileText, CheckCircle, Clock, MessageSquare,
  TrendingUp, BookOpen, Award, ArrowRight, Activity, Video, Plus, Code, Layers, Sparkles, Coffee
} from 'lucide-react'
import NotesSection from '../components/trainer/notes/NotesSection'
import ParticipantProfileView from '../components/shared/ParticipantProfileView'
import TrainerCourses from './TrainerCourses'
import { useToast } from '../components/Toast'
import Pagination from '../components/Pagination'
import { Button, Badge, EmptyState, StatCard, ProgressBar } from '../components/ui'
import { API_BASE } from '../api/api'
import HeroBanner from '../components/saas/HeroBanner'
import KpiCard from '../components/saas/KpiCard'
import CourseCard from '../components/saas/CourseCard'
import SearchBar from '../components/saas/SearchBar'
import FilterPills from '../components/saas/FilterPills'

const API = API_BASE

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } }
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
}

function getCourseArtwork(title) {
  const t = (title || '').toLowerCase()
  if (t.includes('node') || t.includes('js') || t.includes('javascript')) {
    return {
      bg: 'linear-gradient(135deg, #059669, #0d9488)',
      icon: Code,
      accentColor: 'border-emerald-500',
      label: 'JavaScript / Node.js'
    }
  }
  if (t.includes('java') || t.includes('spring') || t.includes('backend')) {
    return {
      bg: 'linear-gradient(135deg, #ea580c, #f59e0b)',
      icon: Coffee,
      accentColor: 'border-amber-500',
      label: 'Java / Backend'
    }
  }
  if (t.includes('react') || t.includes('web') || t.includes('frontend') || t.includes('html') || t.includes('css')) {
    return {
      bg: 'linear-gradient(135deg, #2563eb, #3b82f6)',
      icon: Sparkles,
      accentColor: 'border-blue-500',
      label: 'Frontend / Web'
    }
  }
  if (t.includes('python') || t.includes('django') || t.includes('ml')) {
    return {
      bg: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
      icon: Code,
      accentColor: 'border-blue-700',
      label: 'Python / ML'
    }
  }
  return {
    bg: 'linear-gradient(135deg, #334155, #64748b)',
    icon: BookOpen,
    accentColor: 'border-slate-500',
    label: 'General Training'
  }
}

function TrainerDashboard({ user, onLogout, activeTab, onTabChange }) {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const tab = activeTab === 'trainings' ? 'courses' : (activeTab || 'overview')
  const [trainings, setTrainings] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [stats, setStats] = useState({
    totalTrainings: 0, avgTrainerRating: 0, totalFeedbacks: 0,
    totalLearners: 0, publishedCourses: 0,
  })
  const [feedbackPage, setFeedbackPage] = useState(1)
  const feedbackItemsPerPage = 5
  const [recentActivity, setRecentActivity] = useState([])
  const [replyModal, setReplyModal] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [viewingParticipant, setViewingParticipant] = useState(null)
  const [trainerReport, setTrainerReport] = useState(null)

  const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` })

  const fetchTrainerReport = async () => {
    try {
      const r = await fetch(`${API}/reports/trainer`, { headers: auth() })
      const d = await r.json()
      if (r.ok && d.success) setTrainerReport(d.data)
    } catch (e) { console.error('fetchTrainerReport error:', e.message) }
  }

  const handleRegenerateCertificate = async () => {
    try {
      const r = await fetch(`${API}/trainer/certificates/regenerate`, { method: 'POST', headers: auth() })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      success('Certificate check/regeneration triggered!')
      fetchTrainerReport()
    } catch (e) { showError(e.message) }
  }

  useEffect(() => {
    fetchTrainings()
    fetchFeedbacks()
  }, [])

  useEffect(() => {
    if (tab === 'reports') fetchTrainerReport()
  }, [tab])

  const fetchTrainings = async () => {
    try {
      const r = await fetch(`${API}/trainer/trainings`, { headers: auth() })
      const d = await r.json()
      const list = d.trainings || []
      setTrainings(list)
      const published = list.filter(t => t.status === 'PUBLISHED').length
      const totalLearners = list.reduce((sum, t) => sum + (t.enrolledCount || t.participantCount || 0), 0)
      setStats(p => ({ ...p, totalTrainings: list.length, publishedCourses: published, totalLearners }))
      const activities = list.slice(0, 8).map((t, i) => ({
        id: i, type: 'course', icon: BookOpen,
        color: t.status === 'PUBLISHED' ? 'text-emerald-500' : 'text-amber-500',
        bg: t.status === 'PUBLISHED' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30',
        message: `"${t.title}" is ${t.status === 'PUBLISHED' ? 'published' : 'in draft'}`,
        time: t.updatedAt || t.createdAt,
      }))
      setRecentActivity(activities)
    } catch (e) { console.error('fetchTrainings error:', e.message) }
  }

  const fetchFeedbacks = async () => {
    try {
      const r = await fetch(`${API}/trainer/feedbacks`, { headers: auth() })
      const d = await r.json()
      const list = d.feedbacks || []
      setFeedbacks(list)
      setStats(p => ({ ...p, avgTrainerRating: d.averageTrainerRating || 0, totalFeedbacks: list.length }))
    } catch (e) { console.error('fetchFeedbacks error:', e.message) }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    try {
      const r = await fetch(`${API}/feedback/${replyModal.id}/reply`, {
        method: 'POST', headers: auth(), body: JSON.stringify({ trainerResponse: replyText })
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.success === false) { showError(d.error || 'Failed to save reply'); return }
      success('Reply submitted!')
      setReplyModal(null); setReplyText(''); fetchFeedbacks()
    } catch (e) { showError(e.message) }
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
  const fmtTimeAgo = (d) => {
    if (!d) return ''
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }
  const initials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'TR'
  const Stars = ({ v }) => (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} size={13} className={s <= v ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'} />
      ))}
    </span>
  )

  const paginatedFeedbacks = [...feedbacks].slice(
    (feedbackPage - 1) * feedbackItemsPerPage,
    feedbackPage * feedbackItemsPerPage
  )
  const totalFeedbackPages = Math.ceil(feedbacks.length / feedbackItemsPerPage)

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-[1440px] mx-auto px-6 py-6 min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Welcome Banner & KPI Cards only on Overview tab ── */}
      {tab === 'overview' && (
        <>
          {/* Welcome Banner */}
          <HeroBanner
            name={user.name}
            subtitle="Here's what's happening with your trainings today."
            onViewReports={() => onTabChange('reports')}
            onViewProfile={() => onTabChange('profile')}
          />

          {/* KPI Cards */}
          <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KpiCard icon={BookOpen} label="Total Courses" value={stats.totalTrainings} bgIcon="rgba(37, 99, 235, 0.08)" colorIcon="#3B82F6" sparkPoints="0,18 8,14 16,16 24,10 32,12 40,6 48,8 56,4 64,2" />
            <KpiCard icon={Users} label="Active Learners" value={stats.totalLearners} bgIcon="rgba(16, 185, 129, 0.08)" colorIcon="#16A34A" sparkPoints="0,16 8,12 16,14 24,8 32,10 40,5 48,7 56,3 64,2" />
            <KpiCard icon={Star} label="Average Rating" value={stats.avgTrainerRating ? Number(stats.avgTrainerRating).toFixed(1) : '—'} bgIcon="rgba(245, 158, 11, 0.08)" colorIcon="#F59E0B" sparkPoints="0,10 8,10 16,10 24,10 32,10 40,10 48,10 56,10 64,10" />
            <KpiCard icon={MessageSquare} label="Feedback Received" value={stats.totalFeedbacks} bgIcon="rgba(124, 58, 237, 0.08)" colorIcon="#7C3AED" sparkPoints="0,18 8,16 16,17 24,15 32,16 40,14 48,15 56,13 64,14" />
          </motion.div>
        </>
      )}

      {/* Overview Grid Layout */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (8 of 12 columns) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* My Trainings Section */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>My Trainings</h2>
                  <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>Quick access to your active courses</p>
                </div>
                <button onClick={() => onTabChange('courses')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all courses <ArrowRight size={12} />
                </button>
              </div>

              {/* Course Cards Grid */}
              {trainings.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <BookOpen size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-slate-500">No courses assigned yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {trainings.slice(0, 2).map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      artwork={getCourseArtwork(c.title)}
                      onManage={() => onTabChange('courses')}
                      onPreview={() => onTabChange('courses')}
                      onMore={() => onTabChange('courses')}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Learning Analytics Overview */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>Learning Analytics Overview</h2>
                  <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>Performance insights across all active tracks</p>
                </div>
                <select className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 outline-none cursor-pointer">
                  <option>This Month</option>
                  <option>This Week</option>
                  <option>Last Quarter</option>
                </select>
              </div>

              {/* Analytics Mini Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Enrollments', value: '12', trend: '+12%', color: '#3b82f6', sparkPoints: '0,18 8,14 16,16 24,10 32,12 40,6 48,8 56,4 64,2' },
                  { label: 'Completions', value: '7', trend: '+8%', color: '#10b981', sparkPoints: '0,16 8,12 16,14 24,8 32,10 40,5 48,7 56,3 64,2' },
                  { label: 'Avg. Quiz Score', value: '78%', trend: '+15%', color: '#f59e0b', sparkPoints: '0,10 8,10 16,10 24,10 32,10 40,10 48,10 56,10 64,10' },
                  { label: 'Attendance Rate', value: '85%', trend: '+10%', color: '#7c3aed', sparkPoints: '0,18 8,16 16,17 24,15 32,16 40,14 48,15 56,13 64,14' }
                ].map((m, idx) => (
                  <div key={idx} className="border border-slate-100 rounded-xl p-4 flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div>
                      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500, display: 'block' }}>{m.label}</span>
                      <span style={{ fontSize: '24px', color: '#0f172a', fontWeight: 700, display: 'block', margin: '4px 0' }}>{m.value}</span>
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>{m.trend}</span>
                    </div>
                    <svg width="60" height="24" viewBox="0 0 64 24" style={{ overflow: 'visible', opacity: 0.8 }} aria-hidden="true">
                      <polyline
                        points={m.sparkPoints}
                        fill="none"
                        stroke={m.color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column (4 of 12 columns - Activity Sidebar) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Upcoming Sessions Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Upcoming Sessions</h3>
                <button onClick={() => onTabChange('courses')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View All</button>
              </div>
              
              <div className="space-y-4">
                {[
                  { date: '16', month: 'JUL', title: 'React Advanced Concepts', time: '10:00 AM - 12:00 PM' },
                  { date: '18', month: 'JUL', title: 'Node.js Best Practices', time: '02:00 PM - 04:00 PM' },
                  { date: '20', month: 'JUL', title: 'Java Collections Framework', time: '11:00 AM - 01:00 PM' }
                ].map((s, idx) => (
                  <div key={idx} className="flex gap-4 items-center p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex flex-col items-center justify-center font-bold text-center shrink-0">
                      <span className="text-[10px] uppercase leading-none font-semibold mb-0.5">{s.month}</span>
                      <span className="text-base leading-none">{s.date}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-800 truncate mb-0.5">{s.title}</h4>
                      <span className="text-xs text-slate-400 font-medium">{s.time}</span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5 uppercase shrink-0">
                      + Live
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Recent Activity</h3>
                <button onClick={() => onTabChange('courses')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View All</button>
              </div>

              {/* Vertical timeline */}
              {recentActivity.length === 0 ? (
                <EmptyState icon={Activity} title="No activity yet" description="Activity will appear here." />
              ) : (
                <div className="relative pl-6 space-y-5">
                  <div className="absolute left-2.5 top-2.5 bottom-2.5 w-[1.5px] bg-slate-100 pointer-events-none" />

                  {recentActivity.slice(0, 4).map((act) => (
                    <div key={act.id} className="relative flex flex-col gap-0.5">
                      <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white ring-4 ring-slate-50" />
                      <p className="text-[13px] font-medium text-slate-700 leading-snug">{act.message}</p>
                      <span className="text-[11px] text-slate-400 font-medium">{fmtTimeAgo(act.time)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6">
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }}>Quick Actions</h3>
              
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Create Course', icon: Plus, bg: 'bg-blue-50 text-blue-600', hover: 'hover:bg-blue-100/50', action: () => { onTabChange('courses'); setTimeout(() => { window.dispatchEvent(new CustomEvent('open-create-course')) }, 100); } },
                  { label: 'Live Session', icon: Video, bg: 'bg-green-50 text-green-600', hover: 'hover:bg-green-100/50', action: () => { window.location.href = '/trainer/monitoring'; } },
                  { label: 'Create Quiz', icon: Sparkles, bg: 'bg-amber-50 text-amber-600', hover: 'hover:bg-amber-100/50', action: () => { success('Launch AI Quiz generator from any Course structure!'); } },
                  { label: 'New Assignment', icon: FileText, bg: 'bg-purple-50 text-purple-600', hover: 'hover:bg-purple-100/50', action: () => { success('Open Assignments editor from Course Details page'); } }
                ].map((act, idx) => (
                  <button
                    key={idx}
                    onClick={act.action}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 bg-slate-50/20 hover:border-slate-200 transition-all text-center group cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${act.bg} mb-2 group-hover:scale-105 transition-transform`}>
                      <act.icon size={18} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>{act.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Courses Tab */}
      {tab === 'courses' && (
        <motion.div variants={item}>
          <TrainerCourses user={user} />
        </motion.div>
      )}

      {tab === 'feedback' && (
        <motion.div variants={item}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Feedback Received</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ratings and comments from participants</p>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{stats.avgTrainerRating ? Number(stats.avgTrainerRating).toFixed(1) : '—'}</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              {feedbacks.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No Feedback Yet" description="Feedback from participants will appear here." />
              ) : (
                <div className="space-y-4">
                  {paginatedFeedbacks.map((fb, i) => (
                    <motion.div
                      key={fb.id || i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-semibold shrink-0">
                        {fb.anonymous ? '?' : initials(fb.participantName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{fb.anonymous ? 'Anonymous' : fb.participantName}</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-400">{fmtDate(fb.submittedAt)}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          for <span className="font-medium text-slate-700 dark:text-slate-300">{fb.trainingTitle}</span>
                        </div>
                        <div className="flex items-center gap-4 mb-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Trainer:</span>
                            <Stars v={fb.trainerRating} />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Subject:</span>
                            <Stars v={fb.subjectRating} />
                          </div>
                        </div>
                        {fb.comments && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">{fb.comments}</p>
                        )}
                        {fb.trainerResponse ? (
                          <div className="mt-2 text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 rounded-lg p-2">
                            <span className="font-semibold">Your reply:</span> {fb.trainerResponse}
                          </div>
                        ) : (
                          <button
                            onClick={() => { setReplyModal(fb); setReplyText(''); }}
                            className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                          >
                            Reply →
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {totalFeedbackPages > 1 && (
                    <Pagination currentPage={feedbackPage} totalPages={totalFeedbackPages} onPageChange={setFeedbackPage} />
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {tab === 'assignments' && (
        <motion.div variants={item}>
          <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-12 text-center">
            <UserPlus size={48} className="mx-auto text-slate-300 mb-4" style={{ color: '#10B981' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Enrollment Requests</h2>
            <p className="text-sm text-slate-500 mt-2">All enrollment requests have been processed. No pending approvals.</p>
          </div>
        </motion.div>
      )}

      {tab === 'interviews' && (
        <motion.div variants={item}>
          <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-12 text-center">
            <Video size={48} className="mx-auto text-slate-300 mb-4" style={{ color: '#10B981' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>My Interviews</h2>
            <p className="text-sm text-slate-500 mt-2">No interviews or video sessions scheduled yet.</p>
          </div>
        </motion.div>
      )}

      {tab === 'notes' && (
        <motion.div variants={item}>
          <NotesSection user={user} />
        </motion.div>
      )}

      {tab === 'reports' && (
        <motion.div variants={item}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reports & Analytics</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Participant progress, quiz results, and submissions</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={handleRegenerateCertificate}>Issue Certificates</Button>
                  <Button size="sm" variant="primary" onClick={fetchTrainerReport}>Refresh</Button>
                </div>
              </div>
            </div>
            <div className="p-6">
              {!trainerReport ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <Activity size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-500">Loading report data...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard label="Average Progress" value={`${trainerReport.averageCompletion || 0}%`} icon={TrendingUp} variant="primary" />
                    <StatCard label="Pending Reviews" value={trainerReport.pendingReviews?.length || 0} icon={Clock} variant="amber" />
                    <StatCard label="Quiz Submissions" value={trainerReport.quizScores?.length || 0} icon={FileText} variant="blue" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Participant Progress</h3>
                    {(!trainerReport.participantProgress || trainerReport.participantProgress.length === 0) ? (
                      <EmptyState icon={Users} title="No participants enrolled" description="No participants enrolled yet." />
                    ) : (
                      <div className="space-y-2">
                        {trainerReport.participantProgress.slice(0, 5).map((p, i) => (
                          <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-semibold">
                              {initials(p.participantName)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{p.participantName}</div>
                              <div className="text-xs text-slate-500">{p.title}</div>
                            </div>
                            <div className="w-24">
                              <ProgressBar value={p.progressPercent} max={100} showLabel color="primary" />
                            </div>
                            <Badge color="success">{p.avgQuizScore}%</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Reply Modal */}
      <AnimatePresence>
        {replyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setReplyModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reply to Feedback</h3>
                <p className="text-sm text-slate-500 mt-1">from {replyModal.participantName}</p>
              </div>
              <form onSubmit={handleReply} className="p-6">
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={4}
                  value={replyText}
                  required
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your response..."
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setReplyModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors">
                    Submit Reply
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ParticipantProfileView
        open={!!viewingParticipant}
        userId={viewingParticipant?.id}
        fallback={viewingParticipant ? { name: viewingParticipant.name } : null}
        onClose={() => setViewingParticipant(null)}
      />
    </motion.div>
  )
}

export default TrainerDashboard
