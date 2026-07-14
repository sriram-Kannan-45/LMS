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
      {/* ── Welcome Banner & KPI Cards ── */}
      {tab === 'overview' && (
        <div style={{ marginBottom: 24 }}>
          {/* Header breadcrumb & title area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>My Trainings</h1>
              <p style={{ fontSize: '14px', color: '#64748B', margin: '4px 0 0' }}>Manage your assigned courses and track your progress.</p>
            </div>
          </div>

          {/* 5 KPI Cards Row */}
          <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <KpiCard icon={BookOpen} label="Total Trainings" value="12" bgIcon="rgba(37, 99, 235, 0.08)" colorIcon="#2563EB" sparkPoints="0,18 8,14 16,16 24,10 32,12 40,6 48,8 56,4 64,2" trend="↑ 20% from last month" trendColor="#10B981" />
            <KpiCard icon={Activity} label="In Progress" value="5" bgIcon="rgba(16, 185, 129, 0.08)" colorIcon="#10B981" sparkPoints="0,16 8,12 16,14 24,8 32,10 40,5 48,7 56,3 64,2" trend="↑ 10% from last month" trendColor="#10B981" />
            <KpiCard icon={CheckCircle} label="Completed" value="7" bgIcon="rgba(245, 158, 11, 0.08)" colorIcon="#F59E0B" sparkPoints="0,10 8,8 16,10 24,6 32,8 40,4 48,6 56,2 64,1" trend="↑ 30% from last month" trendColor="#10B981" />
            <KpiCard icon={Clock} label="Total Hours" value="48h" bgIcon="rgba(59, 130, 246, 0.08)" colorIcon="#3B82F6" sparkPoints="0,18 8,16 16,17 24,15 32,16 40,14 48,15 56,13 64,14" trend="↑ 15% from last month" trendColor="#10B981" />
            <KpiCard icon={Award} label="Certificates" value="4" bgIcon="rgba(124, 58, 237, 0.08)" colorIcon="#7C3AED" sparkPoints="0,12 8,10 16,9 24,11 32,7 40,8 48,5 56,4 64,2" trend="↑ 25% from last month" trendColor="#10B981" />
          </motion.div>
        </div>
      )}

      {/* Main Grid Layout */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (8 of 12 columns) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Continue Learning Section */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Continue Learning</h2>
                <button onClick={() => onTabChange('courses')} className="text-xs font-bold text-blue-600 hover:text-blue-700">View all</button>
              </div>

              {/* Course Cards Grid */}
              <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    {
                      title: 'Python Programming',
                      tech: 'PYTHON / ML',
                      lessons: '8 of 12 lessons',
                      progress: 65,
                      bg: 'url("https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop") center/cover'
                    },
                    {
                      title: 'Machine Learning Basics',
                      tech: 'AI / ML',
                      lessons: '5 of 12 lessons',
                      progress: 40,
                      bg: 'url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop") center/cover'
                    },
                    {
                      title: 'DevOps Fundamentals',
                      tech: 'DEVOPS',
                      lessons: '3 of 15 lessons',
                      progress: 20,
                      bg: 'url("https://images.unsplash.com/photo-1618477388954-7852f32655ec?q=80&w=600&auto=format&fit=crop") center/cover'
                    }
                  ].map((c, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-[18px] overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group" style={{ height: 290 }}>
                      {/* Top: Cover image with overlays */}
                      <div style={{ position: 'relative', height: 140, background: c.bg }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)' }} />
                        {/* Top Left Badge */}
                        <div style={{ position: 'absolute', top: 12, left: 12, padding: '3px 8px', borderRadius: 6, background: '#2563EB', color: '#fff', fontSize: 9, fontWeight: 700 }}>
                          {c.tech}
                        </div>
                        {/* Top Right Badge */}
                        <div style={{ position: 'absolute', top: 12, right: 12, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 10, fontWeight: 600 }}>
                          0 Learners
                        </div>
                        {/* Circular Progress Overlay */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ position: 'relative', width: 64, height: 64 }}>
                            <svg width="64" height="64" viewBox="0 0 64 64">
                              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                              <circle cx="32" cy="32" r="26" fill="none" stroke="#2563EB" strokeWidth="4" strokeDasharray="163" strokeDashoffset={163 - (163 * c.progress) / 100} strokeLinecap="round" transform="rotate(-90 32 32)" />
                            </svg>
                            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                              {c.progress}%
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Bottom Body */}
                      <div className="p-4 flex flex-col justify-between" style={{ height: 150 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 16px', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {c.title}
                        </h3>
                        <div>
                          {/* Progress Line */}
                          <div style={{ height: 6, width: '100%', background: '#F1F5F9', borderRadius: 99, marginBottom: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${c.progress}%`, background: '#2563EB', borderRadius: 99 }} />
                          </div>
                          {/* Progress Text */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', fontWeight: 500 }}>
                            <span>{c.progress}% Complete</span>
                            <span>{c.lessons}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Floating slider right arrow */}
                <button style={{
                  position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)',
                  width: 32, height: 32, borderRadius: '50%', background: '#fff', border: '1px solid #E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer', zIndex: 10
                }} className="hover:text-blue-600">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Learning Progress & Overall Progress Row */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Learning Progress</h2>
                <select className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-700 outline-none cursor-pointer">
                  <option>This Month</option>
                  <option>This Week</option>
                  <option>Last Quarter</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                {/* Left Area Chart (60%) */}
                <div className="md:col-span-7" style={{ minHeight: 200 }}>
                  <svg viewBox="0 0 500 200" width="100%" height="200" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2"/>
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0"/>
                      </linearGradient>
                    </defs>
                    <line x1="0" y1="0" x2="500" y2="0" stroke="#F1F5F9" strokeWidth="1" />
                    <line x1="0" y1="50" x2="500" y2="50" stroke="#F1F5F9" strokeWidth="1" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke="#F1F5F9" strokeWidth="1" />
                    <line x1="0" y1="150" x2="500" y2="150" stroke="#F1F5F9" strokeWidth="1" />
                    <line x1="0" y1="200" x2="500" y2="200" stroke="#E2E8F0" strokeWidth="1.5" />
                    
                    <path
                      d="M 0 150 Q 50 140 100 120 T 200 110 T 300 80 T 400 90 T 500 50 L 500 200 L 0 200 Z"
                      fill="url(#areaGradient)"
                    />
                    <path
                      d="M 0 150 Q 50 140 100 120 T 200 110 T 300 80 T 400 90 T 500 50"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <circle cx="300" cy="80" r="6" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                    <text x="300" y="55" textAnchor="middle" fill="#0F172A" style={{ fontSize: 11, fontWeight: 700 }}>65%</text>
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 10, color: '#64748B', fontWeight: 600 }}>
                    <span>May 1</span>
                    <span>May 5</span>
                    <span>May 10</span>
                    <span>May 15</span>
                    <span>May 20</span>
                    <span>May 25</span>
                    <span>May 30</span>
                  </div>
                </div>

                {/* Right Progress Ring & Stats (40%) */}
                <div className="md:col-span-5 border-l border-slate-100 pl-0 md:pl-8 space-y-6">
                  <div className="text-center">
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>Overall Progress</h3>
                    <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
                      <svg width="100" height="100" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#2563EB" strokeWidth="8" strokeDasharray="264" strokeDashoffset={264 - (264 * 65) / 100} strokeLinecap="round" transform="rotate(-90 50 50)" />
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                        65%
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748B', margin: '10px 0 0', lineHeight: 1.4 }}>
                      Your average completion across all trainings
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 500 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                        <span>Completed</span>
                      </div>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>7</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 500 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }} />
                        <span>In Progress</span>
                      </div>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>5</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Tasks */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Upcoming Tasks</h2>
                <button onClick={() => onTabChange('assignments')} className="text-xs font-bold text-blue-600 hover:text-blue-700">View all</button>
              </div>

              <div className="space-y-4">
                {[
                  { title: 'Complete Quiz', course: 'Python Programming', due: 'Due Tomorrow', color: '#EF4444', bg: '#FEF2F2' },
                  { title: 'Assessment', course: 'Machine Learning Basics', due: 'Due May 16', color: '#3B82F6', bg: '#EFF6FF' },
                  { title: 'Submit Assignment', course: 'DevOps Fundamentals', due: 'Due May 18', color: '#10B981', bg: '#ECFDF5' },
                  { title: 'Feedback Session', course: 'Web Development', due: 'Due May 20', color: '#8B5CF6', bg: '#F5F3FF' }
                ].map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: task.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={16} style={{ color: task.color }} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>{task.title}</h4>
                        <span style={{ fontSize: 12, color: '#64748B' }}>{task.course}</span>
                      </div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: task.color, background: task.bg }}>
                      {task.due}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tip Banner */}
            <div style={{
              background: '#0F172A', borderRadius: '18px', padding: '16px 24px',
              display: 'flex', alignItems: 'center', justifyBetween: 'space-between',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>💡</span>
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pro Tip</h4>
                  <p style={{ fontSize: 13, color: '#E2E8F0', margin: 0 }}>Set weekly learning goals to track your progress better and stay consistent.</p>
                </div>
              </div>
              <button
                onClick={() => success('Launch goals manager!')}
                style={{
                  padding: '8px 16px', background: '#2563EB', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'background 0.2s'
                }}
                className="hover:bg-blue-700"
              >
                Set Goals
              </button>
            </div>

          </div>

          {/* Right Column (4 of 12 columns) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Calendar */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Calendar</h2>
                <button onClick={() => onTabChange('calendar')} className="text-xs font-bold text-blue-600 hover:text-blue-700">View full calendar</button>
              </div>

              {/* Month Header */}
              <div className="text-center font-bold text-sm text-slate-800 flex justify-between items-center">
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><ChevronLeft size={16} /></button>
                <span>May 2025</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><ChevronRight size={16} /></button>
              </div>

              {/* Dates Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px 4px', textAlign: 'center' }}>
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                  <span key={d} style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8' }}>{d}</span>
                ))}
                
                {/* Mock dates */}
                {Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1
                  const isToday = day === 14
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: isToday ? 700 : 500,
                        background: isToday ? '#2563EB' : 'transparent',
                        color: isToday ? '#fff' : '#475569',
                        cursor: 'pointer'
                      }} className={isToday ? '' : 'hover:bg-slate-100'}>
                        {day}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Day Event */}
              <div className="pt-4 border-t border-slate-100">
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Today, May 14, 2025</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F5F3FF', borderRadius: 10, borderLeft: '3px solid #8B5CF6' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6D28D9' }}>Weekly Trainer Meeting</span>
                  <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600 }}>3:00 PM - 4:00 PM</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Recent Activity</h2>
                <button onClick={() => onTabChange('overview')} className="text-xs font-bold text-blue-600 hover:text-blue-700">View all</button>
              </div>

              <div className="space-y-4">
                {[
                  { msg: 'Completed lesson "Functions in Python"', time: '2 hours ago', icon: CheckCircle, color: '#10B981', bg: '#ECFDF5' },
                  { msg: 'Submitted quiz "Python Basics Quiz"', time: '1 day ago', icon: FileText, color: '#3B82F6', bg: '#EFF6FF' },
                  { msg: 'Downloaded resource "Python Cheat Sheet"', time: '2 days ago', icon: BookOpen, color: '#F59E0B', bg: '#FFFBEB' },
                  { msg: 'Earned certificate "Python Basics"', time: '3 days ago', icon: Award, color: '#8B5CF6', bg: '#F5F3FF' }
                ].map((act, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: act.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <act.icon size={13} style={{ color: act.color }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: '0 0 2px', lineHeight: 1.4 }}>{act.msg}</p>
                      <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>{act.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <div className="bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Achievements</h2>
                <button onClick={() => onTabChange('certificates')} className="text-xs font-bold text-blue-600 hover:text-blue-700">View all</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {[
                  { label: 'Quick Learner', color: '#3B82F6', bg: '#EFF6FF' },
                  { label: 'Consistent', color: '#10B981', bg: '#ECFDF5' },
                  { label: 'Problem Solver', color: '#F59E0B', bg: '#FFFBEB' },
                  { label: 'Top Performer', color: '#8B5CF6', bg: '#F5F3FF' }
                ].map((ach, idx) => (
                  <div key={idx} className="text-center" style={{ width: 50 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: ach.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                      <Award size={18} style={{ color: ach.color }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#64748B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ach.label}</span>
                  </div>
                ))}
                
                {/* +2 More */}
                <div className="text-center" style={{ width: 50 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F8FAFC', border: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                    +2
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#64748B', display: 'block' }}>More</span>
                </div>
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
