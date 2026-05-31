import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, BookOpen, FileText, Sparkles, ClipboardList, Folder,
  PlayCircle, CheckCircle2, Clock, ExternalLink, Send, X, Eye,
  Image as ImageIcon, Video, Link as LinkIcon, FilePenLine, Presentation,
  Trophy, AlertCircle,
} from 'lucide-react'
import { API, assetUrl } from '../api/api'
import { useToast } from '../components/Toast'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const auth = (token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

function ProgressBar({ percent, height = 8, color = '#4f46e5' }) {
  const v = Math.max(0, Math.min(100, Number(percent || 0)))
  return (
    <div style={{ height, width: '100%', background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${v}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    NOT_STARTED: { bg: '#f1f5f9', fg: '#64748b', label: 'Not started' },
    IN_PROGRESS: { bg: '#fef3c7', fg: '#92400e', label: 'In progress' },
    COMPLETED:   { bg: '#dcfce7', fg: '#15803d', label: 'Completed' },
  }
  const v = map[status] || map.NOT_STARTED
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
      background: v.bg, color: v.fg, textTransform: 'uppercase', letterSpacing: 0.4,
    }}>{v.label}</span>
  )
}

const MAT_ICON = {
  NOTE:  <FilePenLine size={14} />,
  PDF:   <FileText size={14} />,
  PPT:   <Presentation size={14} />,
  VIDEO: <Video size={14} />,
  IMAGE: <ImageIcon size={14} />,
  LINK:  <LinkIcon size={14} />,
}

// ════════════════════════════════════════════════════════════════════════════
// MY COURSES LIST
// ════════════════════════════════════════════════════════════════════════════
function MyCoursesList({ user, onOpen }) {
  const { error: showError } = useToast()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        setLoading(true)
        const r = await fetch(API.PARTICIPANT_COURSES.LIST, { headers: auth(user.token) })
        const d = await r.json()
        if (!aborted) {
          if (d.success) setCourses(d.courses || [])
          else showError(d.error || 'Failed to load courses')
        }
      } catch (e) { if (!aborted) showError(e.message) }
      finally { if (!aborted) setLoading(false) }
    })()
    return () => { aborted = true }
  }, [])

  return (
    <div style={{ padding: '20px 0' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#0f172a' }}>My Courses</h1>
      <p style={{ marginTop: 4, color: '#64748b', fontSize: 14 }}>
        Continue where you left off, or jump into any of your enrolled courses.
      </p>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 20 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 280, background: '#f1f5f9', borderRadius: 12 }} />)}
        </div>
      ) : courses.length === 0 ? (
        <div style={{
          padding: '60px 24px', textAlign: 'center', background: '#fff',
          border: '1px dashed #cbd5e1', borderRadius: 12, marginTop: 20,
        }}>
          <BookOpen size={48} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', color: '#475569', fontSize: 18, fontWeight: 600 }}>
            No courses yet
          </h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
            Browse the Courses tab to find programs you can enroll in.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16, marginTop: 20,
        }}>
          {courses.map((c, i) => (
            <motion.div
              key={c.courseId}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -3 }}
              onClick={() => onOpen(c.courseId)}
              style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{
                height: 140, position: 'relative',
                background: c.thumbnailUrl
                  ? `url(${assetUrl(c.thumbnailUrl)}) center/cover`
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>
                {!c.thumbnailUrl && <BookOpen size={42} />}
              </div>
              <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{
                  fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px',
                  display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
                  overflow: 'hidden', minHeight: '2.4em', lineHeight: '1.3',
                }}>
                  {c.title}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 11, marginBottom: 10 }}>
                  <Folder size={11} /> {c.programTitle || '—'}
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    <span>Progress</span><span style={{ fontWeight: 700, color: '#4f46e5' }}>{Math.round(c.progressPercent)}%</span>
                  </div>
                  <ProgressBar percent={c.progressPercent} />
                  <button
                    style={{
                      width: '100%', marginTop: 12, padding: '9px 14px',
                      background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <PlayCircle size={14} /> Continue
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// COURSE DETAIL — Overview / Lessons / Resources / Quizzes
// ════════════════════════════════════════════════════════════════════════════
function CourseView({ user, courseId, onBack, onOpenLesson }) {
  const { error: showError } = useToast()
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        setLoading(true)
        const r = await fetch(API.PARTICIPANT_COURSES.OVERVIEW(courseId), { headers: auth(user.token) })
        const d = await r.json()
        if (!aborted) {
          if (d.success) setOverview(d)
          else showError(d.error || 'Failed to load course')
        }
      } catch (e) { if (!aborted) showError(e.message) }
      finally { if (!aborted) setLoading(false) }
    })()
    return () => { aborted = true }
  }, [courseId])

  if (loading) return <div style={{ height: 200, background: '#f1f5f9', borderRadius: 12, margin: 16 }} />
  if (!overview) return null

  const TABS = [
    { key: 'overview',  label: 'Overview',  icon: <BookOpen size={14} /> },
    { key: 'lessons',   label: 'Lessons',   icon: <FileText size={14} /> },
    { key: 'resources', label: 'Resources', icon: <Folder size={14} /> },
    { key: 'quizzes',   label: 'Quizzes',   icon: <Sparkles size={14} /> },
  ]

  return (
    <div style={{ padding: '20px 0' }}>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          fontSize: 13, color: '#475569', cursor: 'pointer', marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> My Courses
      </button>

      {/* Header */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: 20, marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{
          width: 200, height: 130, borderRadius: 10, flexShrink: 0,
          background: overview.course.thumbnailUrl
            ? `url(${assetUrl(overview.course.thumbnailUrl)}) center/cover`
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          {!overview.course.thumbnailUrl && <BookOpen size={48} />}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>{overview.course.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12, marginTop: 4 }}>
            <Folder size={12} /> {overview.course.programTitle || '—'}
            {overview.course.trainer && <>· Trainer: {overview.course.trainer.name}</>}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              <span>Course progress</span>
              <span style={{ fontWeight: 700, color: '#4f46e5' }}>
                {overview.stats.completedLessons} / {overview.stats.totalLessons} lessons · {Math.round(overview.enrollment.progressPercent)}%
              </span>
            </div>
            <ProgressBar percent={overview.enrollment.progressPercent} height={10} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
            <Stat label="Quizzes attempted" value={`${overview.stats.attemptedQuizzes} / ${overview.stats.totalQuizzes}`} />
            <Stat label="Assessments" value={overview.stats.submittedAssessments} />
            <Stat label="Avg quiz score" value={overview.stats.avgQuizScore != null ? `${overview.stats.avgQuizScore.toFixed(1)}%` : '—'} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: 4, display: 'flex', gap: 4, marginBottom: 16,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 14px', border: 'none', cursor: 'pointer',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: tab === t.key ? '#4f46e5' : 'transparent',
              color: tab === t.key ? '#fff' : '#475569',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'overview' && <OverviewView course={overview.course} stats={overview.stats} />}
          {tab === 'lessons' && (
            <LessonsView user={user} courseId={courseId} onOpenLesson={onOpenLesson} />
          )}
          {tab === 'resources' && <ResourcesView user={user} courseId={courseId} />}
          {tab === 'quizzes' && <QuizzesView user={user} courseId={courseId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <strong style={{ color: '#0f172a' }}>{value}</strong>
      <span style={{ color: '#94a3b8' }}>{label}</span>
    </span>
  )
}

function OverviewView({ course, stats }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>About this course</h3>
      <p style={{ margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
        {course.description || 'No description provided yet.'}
      </p>
      {course.trainer && (
        <div style={{
          marginTop: 18, padding: 12, display: 'flex', alignItems: 'center', gap: 12,
          background: '#f8fafc', borderRadius: 10,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>
            {course.trainer.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{course.trainer.name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Course trainer</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Lessons tab ────────────────────────────────────────────────────────────
function LessonsView({ user, courseId, onOpenLesson }) {
  const { error: showError } = useToast()
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch(API.PARTICIPANT_COURSES.LESSONS(courseId), { headers: auth(user.token) })
        const d = await r.json()
        if (!aborted) {
          if (d.success) setLessons(d.lessons || [])
          else showError(d.error || 'Failed to load lessons')
        }
      } catch (e) { if (!aborted) showError(e.message) }
      finally { if (!aborted) setLoading(false) }
    })()
    return () => { aborted = true }
  }, [courseId])

  if (loading) return <div style={{ height: 100, background: '#f1f5f9', borderRadius: 10 }} />
  if (lessons.length === 0) {
    return (
      <div style={emptyCard}>
        <FileText size={36} color="#cbd5e1" />
        <p>No lessons published yet for this course.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lessons.map((l, i) => (
        <motion.div
          key={l.lessonId}
          initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          onClick={() => onOpenLesson(l.lessonId)}
          style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: 14, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: l.progress.status === 'COMPLETED' ? '#dcfce7' : l.progress.status === 'IN_PROGRESS' ? '#fef3c7' : '#eef2ff',
            color: l.progress.status === 'COMPLETED' ? '#15803d' : l.progress.status === 'IN_PROGRESS' ? '#92400e' : '#4f46e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>
            {l.progress.status === 'COMPLETED' ? <CheckCircle2 size={16} /> : (l.orderIndex + 1)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{l.title}</div>
            {l.description && (
              <div style={{
                fontSize: 12, color: '#64748b', marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{l.description}</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusPill status={l.progress.status} />
              {Object.entries(l.materialCounts || {}).filter(([_, n]) => n > 0).map(([t, n]) => (
                <span key={t} style={{ fontSize: 10, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {MAT_ICON[t]} {n}
                </span>
              ))}
              {l.hasAssessment && <span style={{ fontSize: 10, color: '#dc2626' }}>· Assessment</span>}
            </div>
          </div>
          <ArrowLeft size={14} color="#94a3b8" style={{ transform: 'rotate(180deg)' }} />
        </motion.div>
      ))}
    </div>
  )
}

// ── Resources tab ──────────────────────────────────────────────────────────
function ResourcesView({ user, courseId }) {
  const { error: showError } = useToast()
  const [resources, setResources] = useState(null)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch(API.PARTICIPANT_COURSES.RESOURCES(courseId), { headers: auth(user.token) })
        const d = await r.json()
        if (!aborted) {
          if (d.success) setResources(d.resources || {})
          else showError(d.error || 'Failed to load resources')
        }
      } catch (e) { if (!aborted) showError(e.message) }
    })()
    return () => { aborted = true }
  }, [courseId])

  if (!resources) return <div style={{ height: 100, background: '#f1f5f9', borderRadius: 10 }} />

  const sections = [
    ['PDF', 'PDFs'], ['VIDEO', 'Videos'], ['IMAGE', 'Images'],
    ['LINK', 'Links'], ['NOTE', 'Notes'], ['PPT', 'Presentations'],
  ].filter(([k]) => (resources[k] || []).length > 0)

  if (sections.length === 0) {
    return (
      <div style={emptyCard}>
        <Folder size={36} color="#cbd5e1" />
        <p>No materials posted yet.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sections.map(([key, label]) => (
        <div key={key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
          <h4 style={{
            margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0f172a',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {MAT_ICON[key]} {label} ({resources[key].length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resources[key].map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                border: '1px solid #f1f5f9', borderRadius: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a',
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>From: {m.lessonTitle}</div>
                </div>
                {(m.fileUrl || m.linkUrl) && (
                  <a
                    href={m.fileUrl ? assetUrl(m.fileUrl) : m.linkUrl}
                    target="_blank" rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '6px 10px', background: '#eef2ff', color: '#4f46e5',
                      borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={11} /> Open
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Quizzes tab ────────────────────────────────────────────────────────────
function QuizzesView({ user, courseId }) {
  const { error: showError } = useToast()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [openQuizId, setOpenQuizId] = useState(null)

  const refresh = async () => {
    try {
      setLoading(true)
      const r = await fetch(API.PARTICIPANT_COURSES.QUIZZES(courseId), { headers: auth(user.token) })
      const d = await r.json()
      if (d.success) setQuizzes(d.quizzes || [])
      else showError(d.error || 'Failed to load quizzes')
    } catch (e) { showError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [courseId])

  if (loading) return <div style={{ height: 100, background: '#f1f5f9', borderRadius: 10 }} />
  if (quizzes.length === 0) {
    return (
      <div style={emptyCard}>
        <Sparkles size={36} color="#cbd5e1" />
        <p>No quizzes published yet for this course.</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {quizzes.map(q => (
          <div key={q.quizId} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              {q.title}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
              {q.lessonTitle || 'Course-level'} · {q.questionCount} question{q.questionCount !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', justifyContent: 'space-between' }}>
              {q.myStatus === 'SUBMITTED' ? (
                <span style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>
                  ✓ Submitted{q.myScore != null ? ` · ${q.myScore.toFixed(0)}%` : ''}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: '#475569' }}>Not started</span>
              )}
              <button
                onClick={() => setOpenQuizId(q.quizId)}
                style={{
                  padding: '7px 12px', background: '#4f46e5', color: '#fff', border: 'none',
                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                {q.myStatus === 'SUBMITTED' ? <Eye size={12} /> : <PlayCircle size={12} />}
                {q.myStatus === 'SUBMITTED' ? (q.resultStatus === 'PUBLISHED' ? 'View Result' : 'Awaiting Result') : 'Start'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {openQuizId && (
          <QuizModal
            user={user}
            quizId={openQuizId}
            onClose={() => { setOpenQuizId(null); refresh() }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// LESSON DETAIL — Materials / Quiz / Assessment
// ════════════════════════════════════════════════════════════════════════════
function LessonView({ user, lessonId, onBack }) {
  const { error: showError, success } = useToast()
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('materials')
  const [openQuizId, setOpenQuizId] = useState(null)
  const [openAssessmentId, setOpenAssessmentId] = useState(null)

  const fetchLesson = async () => {
    try {
      const r = await fetch(API.PARTICIPANT_COURSES.LESSON(lessonId), { headers: auth(user.token) })
      const d = await r.json()
      if (d.success) setData(d)
      else showError(d.error || 'Failed to load lesson')
    } catch (e) { showError(e.message) }
  }
  useEffect(() => { fetchLesson() }, [lessonId])

  const markViewed = async () => {
    try {
      const r = await fetch(API.PARTICIPANT_COURSES.VIEW_LESSON(lessonId), {
        method: 'POST', headers: auth(user.token),
      })
      const d = await r.json()
      if (d.success) {
        success('Lesson marked as viewed')
        fetchLesson()
      }
    } catch (e) { showError(e.message) }
  }

  if (!data) return <div style={{ height: 200, background: '#f1f5f9', borderRadius: 10, margin: 16 }} />

  const SUBTABS = [
    { key: 'materials',  label: 'Materials',  icon: <Folder size={14} /> },
    { key: 'quiz',       label: 'Quiz',       icon: <Sparkles size={14} /> },
    { key: 'assessment', label: 'Assessment', icon: <ClipboardList size={14} /> },
  ]

  return (
    <div style={{ padding: '20px 0' }}>
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          fontSize: 13, color: '#475569', cursor: 'pointer', marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> Back to course
      </button>

      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: 20, marginBottom: 16,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0f172a' }}>{data.lesson.title}</h1>
        {data.lesson.description && (
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{data.lesson.description}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <StatusPill status={data.progress.status} />
          {!data.progress.contentViewed && (
            <button
              onClick={markViewed}
              style={{
                padding: '7px 14px', background: '#10b981', color: '#fff', border: 'none',
                borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <CheckCircle2 size={12} /> Mark as viewed
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: 4, display: 'flex', gap: 4, marginBottom: 16,
      }}>
        {SUBTABS.map(t => (
          <button
            key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 14px', border: 'none', cursor: 'pointer',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: tab === t.key ? '#4f46e5' : 'transparent',
              color: tab === t.key ? '#fff' : '#475569',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'materials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.lesson.content && (
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Lesson summary
              </div>
              <div style={{ fontSize: 14, color: '#475569', whiteSpace: 'pre-wrap' }}>{data.lesson.content}</div>
            </div>
          )}
          {(data.materials || []).map(m => (
            <MaterialCard key={m.id} material={m} />
          ))}
          {(!data.materials || data.materials.length === 0) && !data.lesson.content && (
            <div style={emptyCard}>
              <Folder size={32} color="#cbd5e1" />
              <p>No materials posted for this lesson yet.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'quiz' && (
        <div>
          {(data.quizzes || []).length === 0 ? (
            <div style={emptyCard}>
              <Sparkles size={32} color="#cbd5e1" />
              <p>No quiz attached to this lesson.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.quizzes.map(q => (
                <div key={q.quizId} style={{
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{q.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {q.questionCount} questions · {q.isMandatory ? 'Mandatory' : 'Optional'}
                    </div>
                  </div>
                  <button
                    onClick={() => setOpenQuizId(q.quizId)}
                    style={{
                      padding: '8px 14px', background: '#4f46e5', color: '#fff', border: 'none',
                      borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {q.myStatus === 'SUBMITTED' ? <Eye size={12} /> : <PlayCircle size={12} />}
                    {q.myStatus === 'SUBMITTED' ? (q.resultStatus === 'PUBLISHED' ? 'View Result' : 'Awaiting Result') : 'Start Quiz'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'assessment' && (
        <div>
          {(data.assessments || []).length === 0 ? (
            <div style={emptyCard}>
              <ClipboardList size={32} color="#cbd5e1" />
              <p>No assessment for this lesson.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.assessments.map(a => (
                <div key={a.assessmentId} style={{
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Max score: {a.maxScore} · Status: <strong>{a.myStatus}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => setOpenAssessmentId(a.assessmentId)}
                      style={{
                        padding: '8px 14px',
                        background: a.myStatus === 'NOT_STARTED' ? '#4f46e5' : '#fff',
                        color: a.myStatus === 'NOT_STARTED' ? '#fff' : '#4f46e5',
                        border: a.myStatus === 'NOT_STARTED' ? 'none' : '1px solid #4f46e5',
                        borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {a.myStatus === 'NOT_STARTED' ? 'Submit' : 'View / Resubmit'}
                    </button>
                  </div>
                  {a.instructions && (
                    <div style={{
                      marginTop: 10, padding: 10, background: '#f8fafc', borderRadius: 8,
                      fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap',
                    }}>
                      {a.instructions}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {openQuizId && (
          <QuizModal user={user} quizId={openQuizId} onClose={() => { setOpenQuizId(null); fetchLesson() }} />
        )}
        {openAssessmentId && (
          <AssessmentModal
            user={user}
            assessmentId={openAssessmentId}
            onClose={() => { setOpenAssessmentId(null); fetchLesson() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MaterialCard({ material }) {
  const m = material
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4f46e5' }}>{MAT_ICON[m.materialType]}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{m.title}</span>
        </div>
        {(m.fileUrl || m.linkUrl) && (
          <a
            href={m.fileUrl ? assetUrl(m.fileUrl) : m.linkUrl}
            target="_blank" rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', background: '#eef2ff', color: '#4f46e5',
              borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <ExternalLink size={11} /> Open
          </a>
        )}
      </div>
      {m.materialType === 'NOTE' && m.content && (
        <div
          dangerouslySetInnerHTML={{ __html: m.content }}
          style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}
        />
      )}
      {m.materialType === 'IMAGE' && m.fileUrl && (
        <img src={assetUrl(m.fileUrl)} alt={m.title} style={{ maxWidth: '100%', borderRadius: 8, marginTop: 4 }} />
      )}
      {m.materialType === 'VIDEO' && m.fileUrl && (
        <video src={assetUrl(m.fileUrl)} controls style={{ maxWidth: '100%', borderRadius: 8, marginTop: 4 }} />
      )}
      {m.materialType === 'LINK' && m.content && (
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{m.content}</p>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// QUIZ MODAL — start, take, submit, view result
// ════════════════════════════════════════════════════════════════════════════
function QuizModal({ user, quizId, onClose }) {
  const { error: showError, success } = useToast()
  const [phase, setPhase] = useState('loading') // loading | taking | submitted-hidden | result | error
  const [attemptId, setAttemptId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [meta, setMeta] = useState(null)
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // First, check if already submitted
  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        // Try to read result first — if SUBMITTED_HIDDEN or PUBLISHED, no need to start
        const rr = await fetch(API.PARTICIPANT_COURSES.QUIZ_RESULT(quizId), { headers: auth(user.token) })
        const dr = await rr.json()
        if (aborted) return
        if (dr.success && dr.status === 'PUBLISHED') {
          setResult(dr); setPhase('result'); return
        }
        if (dr.success && dr.status === 'SUBMITTED_HIDDEN') {
          setResult(dr); setPhase('submitted-hidden'); return
        }
        // Otherwise start
        const rs = await fetch(API.PARTICIPANT_COURSES.QUIZ_START(quizId), {
          method: 'POST', headers: auth(user.token),
        })
        const ds = await rs.json()
        if (aborted) return
        if (!rs.ok || ds.success === false) {
          showError(ds.error || 'Could not start quiz'); setPhase('error'); return
        }
        setAttemptId(ds.attemptId)
        setQuestions(ds.questions || [])
        setMeta(ds.quiz || {})
        setPhase('taking')
      } catch (e) {
        if (!aborted) { showError(e.message); setPhase('error') }
      }
    })()
    return () => { aborted = true }
  }, [quizId])

  const submit = async () => {
    const missing = questions.filter(q => !answers[q.id])
    if (missing.length > 0) {
      if (!window.confirm(`${missing.length} question${missing.length !== 1 ? 's' : ''} unanswered. Submit anyway?`)) return
    }
    try {
      setSubmitting(true)
      const r = await fetch(API.PARTICIPANT_COURSES.QUIZ_SUBMIT(quizId), {
        method: 'POST', headers: auth(user.token),
        body: JSON.stringify({
          attemptId,
          answers: questions.map(q => ({ questionId: q.id, answer: answers[q.id] || '' })),
        }),
      })
      const d = await r.json()
      if (!r.ok || d.success === false) { showError(d.error || 'Submit failed'); return }
      success(d.message)
      // Re-check result
      const rr = await fetch(API.PARTICIPANT_COURSES.QUIZ_RESULT(quizId), { headers: auth(user.token) })
      const dr = await rr.json()
      setResult(dr)
      setPhase(dr.status === 'PUBLISHED' ? 'result' : 'submitted-hidden')
    } catch (e) { showError(e.message) }
    finally { setSubmitting(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={() => !submitting && phase !== 'taking' && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: 18, borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
            {meta?.title || result?.review?.[0]?.questionText ? meta?.title : 'Quiz'}
          </div>
          <button onClick={onClose} disabled={submitting} style={{
            border: 'none', background: '#f1f5f9', color: '#475569', padding: 8, borderRadius: 8, cursor: 'pointer',
          }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          {phase === 'loading' && <div style={{ height: 200, background: '#f1f5f9', borderRadius: 10 }} />}

          {phase === 'taking' && questions.map((q, i) => (
            <div key={q.id} style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 12,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Question {i + 1}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
                {q.questionText}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(q.options || []).map((opt, oi) => (
                  <label key={oi} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                    background: answers[q.id] === opt ? '#eef2ff' : '#fff',
                    border: `1px solid ${answers[q.id] === opt ? '#4f46e5' : '#e2e8f0'}`,
                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.1s',
                  }}>
                    <input
                      type="radio" name={`q-${q.id}`} value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{'ABCD'[oi]}.</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {phase === 'submitted-hidden' && (
            <div style={{ padding: 30, textAlign: 'center' }}>
              <Clock size={42} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                Quiz submitted — awaiting trainer release
              </h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
                {result?.message || 'Your trainer will publish results soon.'}
              </p>
            </div>
          )}

          {phase === 'result' && result && (
            <div>
              <div style={{
                background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                padding: 20, borderRadius: 12, textAlign: 'center', marginBottom: 16,
              }}>
                <Trophy size={28} style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 32, fontWeight: 700 }}>
                  {result.score?.toFixed(0)}%
                </div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {result.totalScore} / {result.maxScore} correct
                </div>
              </div>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0f172a',
                            textTransform: 'uppercase', letterSpacing: 0.5 }}>Question review</h4>
              {(result.review || []).map((q, i) => (
                <div key={q.questionId} style={{
                  background: '#fff', border: `1px solid ${q.isCorrect ? '#86efac' : '#fca5a5'}`,
                  borderRadius: 10, padding: 14, marginBottom: 10,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: q.isCorrect ? '#15803d' : '#dc2626', marginBottom: 4 }}>
                    {q.isCorrect ? '✓ Correct' : '✗ Incorrect'} · Q{i + 1}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>{q.questionText}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    Your answer: <strong>{q.myAnswer || '—'}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#15803d' }}>
                    Correct answer: <strong>{q.correctAnswer}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          {phase === 'error' && (
            <div style={{ padding: 30, textAlign: 'center', color: '#dc2626' }}>
              <AlertCircle size={36} style={{ marginBottom: 8 }} />
              <p>Could not load quiz. Please close and try again.</p>
            </div>
          )}
        </div>

        {phase === 'taking' && (
          <div style={{
            padding: 14, borderTop: '1px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
            background: '#fafbfc',
          }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {Object.keys(answers).length} / {questions.length} answered
            </div>
            <button
              onClick={submit} disabled={submitting}
              style={{
                padding: '10px 20px', background: '#4f46e5', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Send size={14} />
              {submitting ? 'Submitting…' : 'Submit Quiz'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ASSESSMENT MODAL — submit and view result
// ════════════════════════════════════════════════════════════════════════════
function AssessmentModal({ user, assessmentId, onClose }) {
  const { error: showError, success } = useToast()
  const [content, setContent] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch(API.PARTICIPANT_COURSES.ASSESSMENT_RESULT(assessmentId), { headers: auth(user.token) })
        const d = await r.json()
        if (!aborted && d.success) setResult(d)
      } catch {}
    })()
    return () => { aborted = true }
  }, [assessmentId])

  const submit = async () => {
    if (!content.trim() && !fileUrl.trim()) {
      showError('Please write a response or paste a file URL')
      return
    }
    try {
      setSubmitting(true)
      const r = await fetch(API.PARTICIPANT_COURSES.ASSESSMENT_SUBMIT(assessmentId), {
        method: 'POST', headers: auth(user.token),
        body: JSON.stringify({ content, fileUrl: fileUrl || null }),
      })
      const d = await r.json()
      if (!r.ok || d.success === false) { showError(d.error || 'Submit failed'); return }
      success('Assessment submitted')
      onClose()
    } catch (e) { showError(e.message) }
    finally { setSubmitting(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={() => !submitting && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 540, padding: 22 }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
          Assessment Submission
        </h3>

        {result && result.status === 'PUBLISHED' ? (
          <div style={{
            padding: 14, background: '#dcfce7', borderRadius: 10, marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Result published
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#15803d', margin: '4px 0' }}>
              {result.score} / {result.maxScore}
            </div>
            {result.feedback && (
              <div style={{ marginTop: 6, fontSize: 13, color: '#15803d' }}>
                <strong>Feedback:</strong> {result.feedback}
              </div>
            )}
          </div>
        ) : result && result.status !== 'NOT_STARTED' && (
          <div style={{
            padding: 12, background: '#fef3c7', color: '#92400e', borderRadius: 8,
            fontSize: 12, marginBottom: 16,
          }}>
            <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {result.message || 'Submission received. Trainer will review and publish soon.'}
          </div>
        )}

        <label style={lblStyle}>Your response</label>
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Write your response here…"
          style={{ ...inputStyle, resize: 'vertical' }}
        />

        <label style={lblStyle}>Or paste a file URL (optional)</label>
        <input
          value={fileUrl} onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://drive.google.com/…"
          style={inputStyle}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={submitting} style={btnSecondary}>Close</button>
          <button onClick={submit} disabled={submitting} style={btnPrimary}>
            <Send size={14} style={{ marginRight: 6 }} />
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY — switches between list / course / lesson
// ════════════════════════════════════════════════════════════════════════════
export default function ParticipantCourses({ user }) {
  const [view, setView] = useState({ mode: 'list', courseId: null, lessonId: null })

  if (view.mode === 'lesson') {
    return (
      <LessonView
        user={user}
        lessonId={view.lessonId}
        onBack={() => setView({ mode: 'course', courseId: view.courseId })}
      />
    )
  }
  if (view.mode === 'course') {
    return (
      <CourseView
        user={user}
        courseId={view.courseId}
        onBack={() => setView({ mode: 'list' })}
        onOpenLesson={(lessonId) => setView({ mode: 'lesson', courseId: view.courseId, lessonId })}
      />
    )
  }
  return (
    <MyCoursesList user={user} onOpen={(courseId) => setView({ mode: 'course', courseId })} />
  )
}

// ── shared style helpers ────────────────────────────────────────────────────
const lblStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#475569',
  marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
}
const inputStyle = {
  width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center',
  padding: '10px 18px', background: '#4f46e5', color: '#fff', border: 'none',
  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSecondary = {
  padding: '10px 18px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const emptyCard = {
  padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13,
  background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
}
