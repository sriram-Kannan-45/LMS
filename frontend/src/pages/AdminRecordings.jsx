import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, X, Play, Download, Trash2, ChevronLeft, ChevronRight, Monitor } from 'lucide-react'
import { API_BASE } from '../api/api'
import { useToast } from '../components/Toast'
import VideoPlayer from '../components/shared/VideoPlayer'
import RecordingStatusBadge from '../components/shared/RecordingStatusBadge'

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
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="p-6 max-w-7xl mx-auto">
      <motion.div variants={itemVariants} className="mb-6">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>Quiz Screen Recordings</h1>
        <p className="text-gray-500 mt-1">Monitor participant activity during quiz sessions</p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input
            placeholder="Search participant..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filters.quiz_id}
            onChange={e => setFilters(f => ({ ...f, quiz_id: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Quizzes</option>
            {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
          <select
            value={filters.trainer_id}
            onChange={e => setFilters(f => ({ ...f, trainer_id: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Trainers</option>
            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="From"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="To"
          />
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Status</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={applyFilters} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">Apply Filters</button>
          <button onClick={resetFilters} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors">Reset</button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading recordings...</div>
        ) : recordings.length === 0 ? (
          <div className="p-12 text-center">
            <Monitor size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No recordings found</p>
            <p className="text-gray-400 text-sm mt-1">Recordings appear here after participants complete a proctored quiz session.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Participant</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Quiz</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Trainer</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Date & Time</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Duration</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Size</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((rec, idx) => (
                  <tr key={rec.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-400">{(pagination.page - 1) * pagination.limit + idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">
                          {initials(rec.participant?.name)}
                        </div>
                        <span className="font-medium text-gray-800">{rec.participant?.name || `User #${rec.participantId}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{rec.quiz?.title || `Quiz #${rec.quizId}`}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.trainer?.name || `Trainer #${rec.trainerId}`}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(rec.recordedAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDuration(rec.durationSeconds)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtSize(rec.fileSizeMb)}</td>
                    <td className="px-4 py-3"><RecordingStatusBadge status={rec.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleWatch(rec)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Watch">
                          <Play size={16} />
                        </button>
                        <button onClick={() => handleDownload(rec)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Download">
                          <Download size={16} />
                        </button>
                        <button onClick={() => handleDelete(rec.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && !loading && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchRecordings(pagination.page - 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => fetchRecordings(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === pagination.page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchRecordings(pagination.page + 1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
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
