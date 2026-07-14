import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, X, Play, Download, Trash2, ChevronLeft, ChevronRight, Monitor } from 'lucide-react'
import { API_BASE } from '../api/api'
import { useToast } from '../components/Toast'
import VideoPlayer from '../components/shared/VideoPlayer'
import RecordingStatusBadge from '../components/shared/RecordingStatusBadge'
import { Button, Badge, Table, PageHeader, EmptyState } from '../components/ui'

const auth = (user) => ({ Authorization: `Bearer ${user.token}` })

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

function fmtSize(mb) {
  if (!mb) return '-'
  return mb < 1 ? `${Math.round(mb * 1024)} KB` : `${mb.toFixed(1)} MB`
}

function fmtDuration(s) {
  if (!s) return '-'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}

function fmtDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function AdminRecordings({ user }) {
  const { success, error: showError } = useToast()

  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [quizzes, setQuizzes] = useState([])
  const [trainers, setTrainers] = useState([])

  const [filters, setFilters] = useState({
    search: '', quiz_id: '', trainer_id: '', date_from: '', date_to: '', status: ''
  })
  const [appliedFilters, setAppliedFilters] = useState({})

  const [selectedRecording, setSelectedRecording] = useState(null)
  const [streamUrl, setStreamUrl] = useState('')
  const [recordingDetail, setRecordingDetail] = useState(null)

  const fetchRecordings = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      Object.entries(appliedFilters).forEach(([k, v]) => { if (v) params.set(k, v) })
      const r = await fetch(`${API_BASE}/recordings?${params}`, { headers: auth(user) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.message || 'Failed to fetch recordings')
      setRecordings(d.data.recordings)
      setPagination(d.data.pagination)
    } catch (e) {
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, user, showError])

  const fetchQuizzes = async () => {
    try {
      const r = await fetch(`${API_BASE}/quizzes`, { headers: auth(user) })
      const d = await r.json()
      if (r.ok) setQuizzes(d.quizzes || d.data?.quizzes || [])
    } catch {}
  }

  const fetchTrainers = async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/trainers`, { headers: auth(user) })
      const d = await r.json()
      if (r.ok) setTrainers(d.trainers || d.data?.trainers || [])
    } catch {}
  }

  useEffect(() => { fetchRecordings(); fetchQuizzes(); fetchTrainers() }, [])

  useEffect(() => { fetchRecordings() }, [appliedFilters])

  const applyFilters = () => setAppliedFilters({ ...filters, page: 1 })
  const resetFilters = () => {
    setFilters({ search: '', quiz_id: '', trainer_id: '', date_from: '', date_to: '', status: '' })
    setAppliedFilters({})
  }

  const handleWatch = async (recording) => {
    setSelectedRecording(recording)
    setStreamUrl('')
    setRecordingDetail(null)
    try {
      const r = await fetch(`${API_BASE}/recordings/${recording.id}`, { headers: auth(user) })
      const d = await r.json()
      if (r.ok) setRecordingDetail(d.data)
      const token = user.token
      setStreamUrl(`${API_BASE}/recordings/${recording.id}/stream?token=${token}`)
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this recording?')) return
    try {
      const r = await fetch(`${API_BASE}/recordings/${id}`, { method: 'DELETE', headers: auth(user) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.message || 'Failed to delete')
      success('Recording deleted successfully')
      fetchRecordings(pagination.page)
    } catch (e) {
      showError(e.message)
    }
  }

  const handleDownload = async (recording) => {
    try {
      const r = await fetch(`${API_BASE}/recordings/${recording.id}/stream?token=${user.token}`)
      if (!r.ok) throw new Error('Download failed')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recording_${recording.id}.webm`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      showError(e.message)
    }
  }

  const initials = (name) =>
    name ? name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '--'

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Quiz Screen Recordings"
        subtitle="Monitor and audit participant activity feeds during proctored quiz sessions."
      />

      <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Filter size={16} className="text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filter Recordings</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input
            placeholder="Search participant..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={filters.quiz_id}
            onChange={e => setFilters(f => ({ ...f, quiz_id: e.target.value }))}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Quizzes</option>
            {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
          <select
            value={filters.trainer_id}
            onChange={e => setFilters(f => ({ ...f, trainer_id: e.target.value }))}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Trainers</option>
            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={applyFilters} variant="primary" size="sm">Apply Filters</Button>
          <Button onClick={resetFilters} variant="secondary" size="sm">Reset</Button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading recordings...</div>
        ) : recordings.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="No recordings found"
            description="Recordings appear here after participants complete a proctored quiz session."
          />
        ) : (
          <div className="space-y-4">
            <Table
              columns={[
                { key: 'index', header: '#', render: (_, idx) => (pagination.page - 1) * pagination.limit + idx + 1 },
                {
                  key: 'participant',
                  header: 'Participant',
                  render: (row) => (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-500 dark:bg-primary-950/40 dark:text-primary-400 flex items-center justify-center text-xs font-bold border border-primary-100 dark:border-primary-900/30">
                        {initials(row.participant?.name)}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{row.participant?.name || `User #${row.participantId}`}</span>
                    </div>
                  ),
                },
                { key: 'quiz', header: 'Quiz', render: (row) => row.quiz?.title || `Quiz #${row.quizId}` },
                { key: 'trainer', header: 'Trainer', render: (row) => row.trainer?.name || `Trainer #${row.trainerId}` },
                { key: 'recordedAt', header: 'Date & Time', render: (row) => fmtDate(row.recordedAt) },
                { key: 'duration', header: 'Duration', render: (row) => fmtDuration(row.durationSeconds) },
                { key: 'size', header: 'Size', render: (row) => fmtSize(row.fileSizeMb) },
                { key: 'status', header: 'Status', render: (row) => <RecordingStatusBadge status={row.status} /> },
                {
                  key: 'actions',
                  header: '',
                  className: 'text-right',
                  render: (row) => (
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => handleWatch(row)} icon={Play} className="text-primary-500 dark:text-primary-400" title="Watch" />
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(row)} icon={Download} className="text-slate-500 dark:text-slate-400" title="Download" />
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)} icon={Trash2} className="text-rose-500 hover:text-rose-700" title="Delete" />
                    </div>
                  ),
                },
              ]}
              data={recordings}
            />

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Showing {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchRecordings(pagination.page - 1)}
                    variant="secondary"
                    size="sm"
                    icon={ChevronLeft}
                  />
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                    <Button
                      key={p}
                      onClick={() => fetchRecordings(p)}
                      variant={p === pagination.page ? 'primary' : 'secondary'}
                      size="sm"
                      className="w-8 h-8 p-0"
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchRecordings(pagination.page + 1)}
                    variant="secondary"
                    size="sm"
                    icon={ChevronRight}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {selectedRecording && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRecording(null)}>
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <button onClick={() => setSelectedRecording(null)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  <ChevronLeft size={16} /> Back
                </button>
                <h3 className="text-lg font-semibold mt-1">
                  {selectedRecording.participant?.name || `User #${selectedRecording.participantId}`}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedRecording.quiz?.title || `Quiz #${selectedRecording.quizId}`} &middot;
                  Trainer: {selectedRecording.trainer?.name || `#${selectedRecording.trainerId}`} &middot;
                  Recorded: {fmtDate(selectedRecording.recordedAt)}
                </p>
              </div>
            </div>

            <div className="p-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {streamUrl ? (
                  <VideoPlayer src={streamUrl} className="w-full h-full" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">Loading video...</div>
                )}
              </div>
            </div>

            {recordingDetail?.quizResult && (
              <div className="p-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Participant Info</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-500 text-xs">Score</span>
                    <p className="font-semibold text-gray-800">{recordingDetail.quizResult.percentage || '-'}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-500 text-xs">Time Taken</span>
                    <p className="font-semibold text-gray-800">
                      {recordingDetail.quizResult.attempt?.timeTaken
                        ? `${Math.floor(recordingDetail.quizResult.attempt.timeTaken / 60)} min`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-500 text-xs">Questions</span>
                    <p className="font-semibold text-gray-800">
                      {recordingDetail.quizResult.maxScore
                        ? `${recordingDetail.quizResult.totalScore}/${recordingDetail.quizResult.maxScore}`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-500 text-xs">Submitted</span>
                    <p className="font-semibold text-gray-800">
                      {recordingDetail.quizResult.attempt?.submittedAt ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
