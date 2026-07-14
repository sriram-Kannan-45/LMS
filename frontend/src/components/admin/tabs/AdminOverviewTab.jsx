import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { StatCard, DonutChart, ProgressBar } from '../../ui'
import {
  Sparkles, BookOpen, Users, UserCheck, Activity, MessageSquare,
  Star, Award, TrendingUp, ArrowRight, Calendar, Clock,
  FileText, UserPlus, ClipboardList, HelpCircle, Upload, Send,
  ChevronRight, Eye
} from 'lucide-react'

const CHART_COLORS = {
  enrollments: '#0D9488',
  completions: '#2563eb',
}

const ENGAGEMENT_COLORS = {
  active: '#0D9488',
  completed: '#2563eb',
  inProgress: '#10b981',
  notStarted: '#f59e0b',
}

const ACTIVITY_TYPES = [
  { type: 'lesson', icon: BookOpen, bg: '#0D9488', label: 'New lesson added' },
  { type: 'enrollment', icon: Users, bg: '#10b981', label: 'New enrollments' },
  { type: 'feedback', icon: Star, bg: '#f59e0b', label: 'New feedback received' },
  { type: 'quiz', icon: ClipboardList, bg: '#2563eb', label: 'Quiz created' },
]

const TRAINER_GRADIENTS = [
  'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
  'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #059669 0%, #34d399 100%)',
  'linear-gradient(135deg, #ea580c 0%, #fb923c 100%)',
  'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
]

function getTimeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatRelativeTime(date) {
  const now = new Date()
  const diff = now - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function getChartDates() {
  const dates = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 2)
    dates.push(
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    )
  }
  return dates
}

function generateChartData(stats) {
  const dates = getChartDates()
  const totalEnroll = stats.totalEnrollments || 0
  const baseEnroll = Math.max(Math.floor(totalEnroll * 0.08), 3)
  const baseComplete = Math.max(Math.floor(baseEnroll * 0.6), 2)

  return dates.map((date, i) => {
    const progress = (i + 1) / dates.length
    const noise = () => Math.floor(Math.random() * 8 - 4)
    return {
      date,
      Enrollments: Math.max(0, Math.round(baseEnroll * (0.5 + progress * 0.8) + noise())),
      Completions: Math.max(0, Math.round(baseComplete * (0.3 + progress * 0.9) + noise())),
    }
  })
}

function generateActivities(trainings, feedbacks, stats) {
  const activities = []
  const recentTrainings = (trainings || []).slice(0, 3)
  const recentFeedbacks = (feedbacks || []).slice(0, 2)

  recentTrainings.forEach((t, i) => {
    activities.push({
      id: `t-${t.id || i}`,
      type: 'lesson',
      title: ACTIVITY_TYPES[0].label,
      description: t.title || 'Untitled Training',
      time: t.startDate || new Date(Date.now() - (i + 1) * 7200000).toISOString(),
    })
  })

  if (stats && stats.totalEnrollments > 0) {
    activities.push({
      id: 'enroll-latest',
      type: 'enrollment',
      title: ACTIVITY_TYPES[1].label,
      description: `${stats.totalEnrollments} total enrollments`,
      time: new Date(Date.now() - 3600000).toISOString(),
    })
  }

  recentFeedbacks.forEach((f, i) => {
    activities.push({
      id: `f-${f.id || i}`,
      type: 'feedback',
      title: ACTIVITY_TYPES[2].label,
      description: f.trainingTitle || 'Anonymous feedback',
      time: f.submittedAt || new Date(Date.now() - (i + 2) * 1800000).toISOString(),
    })
  })

  return activities.slice(0, 6)
}

function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e4e4e7',
      borderRadius: 12, padding: '10px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 13,
      fontFamily: "'Poppins', sans-serif",
    }}>
      <div style={{ fontWeight: 700, color: '#0f0f10', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, fontWeight: 600, color: p.color, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

export default function AdminOverviewTab({ user, stats, feedbacks, trainings, participants, initialLoading, loading }) {
  const greeting = getTimeGreeting()
  const firstName = user?.name?.split(' ')[0] || 'Admin'

  const chartData = useMemo(() => generateChartData(stats), [stats])

  const activities = useMemo(() => generateActivities(trainings, feedbacks, stats), [trainings, feedbacks, stats])

  const engagementData = useMemo(() => {
    const total = stats.totalParticipants || 0
    const activePct = total > 0 ? Math.min(42, Math.round(total * 0.42)) : 0
    const completedPct = total > 0 ? Math.round(total * 0.28) : 0
    const inProgressPct = total > 0 ? Math.round(total * 0.18) : 0
    const notStartedPct = total - activePct - completedPct - inProgressPct

    return {
      total,
      segments: [
        { name: 'Active Learners', value: Math.max(activePct, 0), color: ENGAGEMENT_COLORS.active },
        { name: 'Completed', value: Math.max(completedPct, 0), color: ENGAGEMENT_COLORS.completed },
        { name: 'In Progress', value: Math.max(inProgressPct, 0), color: ENGAGEMENT_COLORS.inProgress },
        { name: 'Not Started', value: Math.max(notStartedPct, 0), color: ENGAGEMENT_COLORS.notStarted },
      ],
    }
  }, [stats])

  const myTrainings = useMemo(() => {
    return (trainings || []).slice(0, 5).map((t, i) => ({
      ...t,
      completion: Math.min(100, Math.max(10, Math.floor(Math.random() * 80 + 20))),
      learners: t.enrolledCount ?? Math.floor(Math.random() * 50 + 5),
      gradient: TRAINER_GRADIENTS[i % TRAINER_GRADIENTS.length],
      isPublished: i < 3,
    }))
  }, [trainings])

  const upcomingSessions = useMemo(() => {
    return (trainings || []).slice(0, 4).map((t, i) => ({
      id: t.id,
      title: t.title,
      date: t.startDate
        ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date(Date.now() + (i + 1) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: t.startDate
        ? new Date(t.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : `${9 + i}:00 AM`,
    }))
  }, [trainings])

  const quickLinks = [
    { icon: FileText, label: 'Create Assignment', color: '#0D9488', bg: 'rgba(13,148,136,0.08)' },
    { icon: Upload, label: 'Upload Resource', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
    { icon: ClipboardList, label: 'Create Quiz', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
    { icon: Send, label: 'Send Announcement', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  ]

  const statItems = [
    { label: 'Total Trainings', value: stats.totalTrainings ?? 0, icon: BookOpen, color: '#0D9488' },
    { label: 'Total Participants', value: stats.totalParticipants ?? 0, icon: UserCheck, color: '#10b981' },
    { label: 'Active Enrollments', value: stats.totalEnrollments ?? 0, icon: Activity, color: '#2563eb' },
    { label: 'Avg Trainer Rating', value: stats.avgTrainerRating ?? '0.0', icon: Star, color: '#f59e0b' },
  ]

  return (
    <motion.div
      className="ov-shell"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Banner — condensed */}
      <motion.section variants={itemVariants} className="ov-hero">
        <span className="ov-hero__bloom" aria-hidden />
        <div className="ov-hero__inner">
          <div className="ov-hero__left">
            <span className="ov-hero__kicker">
              <Sparkles size={12} aria-hidden /> {greeting}
            </span>
            <h1 className="ov-hero__title">
              Welcome back, <span className="ov-hero__title-name">{firstName}</span>
            </h1>
            <p className="ov-hero__subtitle">
              Here&apos;s what&apos;s happening across your platform today.
            </p>
          </div>
          <div className="ov-hero__right">
            <div className="ov-hero__avatar" aria-hidden>
              {user?.name ? user.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'AD'}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Quick Stat Strip */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard label="Total Trainings" value={stats.totalTrainings ?? 0} icon={BookOpen} variant="primary" />
        <StatCard label="Total Participants" value={stats.totalParticipants ?? 0} icon={UserCheck} variant="emerald" />
        <StatCard label="Active Enrollments" value={stats.totalEnrollments ?? 0} icon={Activity} variant="blue" />
        <StatCard label="Avg Trainer Rating" value={stats.avgTrainerRating ?? '0.0'} icon={Star} variant="amber" />
      </motion.div>

      {/* Row 1: Training Overview + Recent Activities */}
      <div className="dash-grid-65-35">
        {/* Training Overview Chart */}
        <motion.section variants={itemVariants} className="ac-card dash-card">
          <div className="dash-card__header">
            <div>
              <h3 className="dash-card__title">Training Overview</h3>
              <p className="dash-card__subtitle">Enrollments &amp; completions over time</p>
            </div>
            <span className="ac-chip ac-chip-primary">
              <TrendingUp size={11} /> This Month
            </span>
          </div>
          {initialLoading ? (
            <div className="dash-chart-skeleton" />
          ) : (
            <div className="dash-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradEnroll" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.enrollments} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={CHART_COLORS.enrollments} stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="gradComplete" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.completions} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={CHART_COLORS.completions} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date" tick={{ fill: '#79797e', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#79797e', fontSize: 11 }}
                    axisLine={false} tickLine={false} width={36}
                    domain={[0, 'auto']}
                  />
                  <Tooltip content={<CustomChartTooltip />} cursor={{ stroke: 'rgba(13,148,136,0.1)', strokeWidth: 1 }} />
                  <Area
                    type="monotone" dataKey="Enrollments"
                    stroke={CHART_COLORS.enrollments} strokeWidth={2.5}
                    fill="url(#gradEnroll)" dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: CHART_COLORS.enrollments }}
                  />
                  <Area
                    type="monotone" dataKey="Completions"
                    stroke={CHART_COLORS.completions} strokeWidth={2}
                    fill="url(#gradComplete)" dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: CHART_COLORS.completions }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.section>

        {/* Recent Activities */}
        <motion.section variants={itemVariants} className="ac-card dash-card">
          <div className="dash-card__header">
            <h3 className="dash-card__title">Recent Activities</h3>
            <button className="dash-view-all">View All <ArrowRight size={12} /></button>
          </div>
          <div className="dash-activity-list">
            {activities.length === 0 ? (
              <div className="dash-empty-mini">
                <Activity size={20} />
                <span>No recent activity</span>
              </div>
            ) : (
              activities.map((a) => {
                const typeInfo = ACTIVITY_TYPES.find(t => t.type === a.type) || ACTIVITY_TYPES[0]
                const Icon = typeInfo.icon
                return (
                  <div key={a.id} className="dash-activity-item">
                    <div className="dash-activity-icon" style={{ background: `${typeInfo.bg}12`, color: typeInfo.bg }}>
                      <Icon size={14} strokeWidth={2} />
                    </div>
                    <div className="dash-activity-body">
                      <span className="dash-activity-title">{a.title}</span>
                      <span className="dash-activity-desc">{a.description}</span>
                    </div>
                    <span className="dash-activity-time">{formatRelativeTime(a.time)}</span>
                  </div>
                )
              })
            )}
          </div>
        </motion.section>
      </div>

      {/* Row 2: My Trainings + Learner Engagement */}
      <div className="dash-grid-65-35">
        {/* My Trainings */}
        <motion.section variants={itemVariants} className="ac-card dash-card">
          <div className="dash-card__header">
            <h3 className="dash-card__title">My Trainings</h3>
            <button className="dash-view-all">View All <ArrowRight size={12} /></button>
          </div>
          {myTrainings.length === 0 ? (
            <div className="dash-empty-mini">
              <BookOpen size={20} />
              <span>No trainings yet</span>
            </div>
          ) : (
            <div className="dash-training-scroll">
              {myTrainings.map((t, i) => (
                <motion.div
                  key={t.id || i}
                  className="dash-training-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  whileHover={{ y: -3 }}
                >
                  <div className="dash-training-banner" style={{ background: t.gradient }}>
                    <span className={`dash-training-status ${t.isPublished ? 'dash-training-status--pub' : 'dash-training-status--draft'}`}>
                      {t.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div className="dash-training-info">
                    <h4 className="dash-training-name">{t.title}</h4>
                    <div className="dash-training-meta-row">
                      <span className="dash-training-meta">
                        <Users size={12} /> {t.learners} Learners
                      </span>
                      <span className="dash-training-meta">{t.completion}%</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={t.completion} max={100} color={t.completion > 70 ? 'emerald' : t.completion > 40 ? 'blue' : 'violet'} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Learner Engagement Donut */}
        <motion.section variants={itemVariants} className="ac-card dash-card">
          <div className="dash-card__header">
            <h3 className="dash-card__title">Learner Engagement</h3>
            <span className="ac-chip ac-chip-primary" style={{ fontSize: 11 }}>
              <Eye size={10} /> This Month
            </span>
          </div>
          <div className="dash-engagement py-4">
            <DonutChart data={engagementData.segments} colors={['#0D9488', '#3b82f6', '#10b981', '#f59e0b']} height={200} />
          </div>
        </motion.section>
      </div>

      {/* Row 3: Upcoming Sessions + Quick Links */}
      <div className="dash-grid-50-50">
        {/* Upcoming Sessions */}
        <motion.section variants={itemVariants} className="ac-card dash-card">
          <div className="dash-card__header">
            <h3 className="dash-card__title">Upcoming Sessions</h3>
          </div>
          <div className="dash-sessions-list">
            {upcomingSessions.length === 0 ? (
              <div className="dash-empty-mini">
                <Calendar size={20} />
                <span>No upcoming sessions</span>
              </div>
            ) : (
              upcomingSessions.map((s, i) => (
                <div key={s.id || i} className="dash-session-item">
                  <div className="dash-session-icon">
                    <Calendar size={14} strokeWidth={2} />
                  </div>
                  <div className="dash-session-body">
                    <span className="dash-session-title">{s.title}</span>
                    <span className="dash-session-datetime">
                      <Clock size={11} /> {s.date} &middot; {s.time}
                    </span>
                  </div>
                  <span className="dash-session-badge">Live Session</span>
                </div>
              ))
            )}
          </div>
        </motion.section>

        {/* Quick Links */}
        <motion.section variants={itemVariants} className="ac-card dash-card">
          <div className="dash-card__header">
            <h3 className="dash-card__title">Quick Links</h3>
          </div>
          <div className="dash-quick-links">
            {quickLinks.map((l, i) => (
              <motion.button
                key={l.label}
                className="dash-quick-link"
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <div className="dash-quick-link__icon" style={{ background: l.bg, color: l.color }}>
                  <l.icon size={20} strokeWidth={1.8} />
                </div>
                <span className="dash-quick-link__label">{l.label}</span>
              </motion.button>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  )
}
