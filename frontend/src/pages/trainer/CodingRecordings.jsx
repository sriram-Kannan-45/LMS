import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Monitor, Filter, Search, Play } from 'lucide-react'
import { API_BASE } from '../../api/api'
import { useToast } from '../../components/Toast'
import {
  formatDate,
  formatDuration,
  getAssessmentTitle,
  getScore,
  getStatusBadgeClasses,
  buildApiUrl
} from './CodingRecordings.utils'

const auth = (user) => ({ Authorization: `Bearer ${user.token}` })

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }
}

export default function CodingRecordings({ user }) {
  const navigate = useNavigate()
  const { error: showError } = useToast()

  const [recordings, setRecordings] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('coding')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchRecordings = useCallback(async () => {
    setLoading(true)
    try {
      const url = buildApiUrl(`${API_BASE}/recordings`, typeFilter)
      const r = await fetch(url, { headers: auth(user) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.message || 'Failed to fetch recordings')
      setRecordings(d.data?.recordings || d.recordings || [])
    } catch (e) {
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, typeFilter, showError])

  useEffect(() => {
    fetchRecordings()
  }, [fetchRecordings])

  const applySearch = () => {
    setAppliedSearch(search)
    setPage(1)
  }

  const clearSearch = () => {
    setSearch('')
    setAppliedSearch('')
    setPage(1)
  }

  const filtered = recordings
    .filter((rec) => {
      if (!appliedSearch) return true
      const q = appliedSearch.toLowerCase()
      const name = (rec.participant?.name || '').toLowerCase()
      const email = (rec.participant?.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.recordedAt) - new Date(a.recordedAt)
      if (sortBy === 'oldest') return new Date(a.recordedAt) - new Date(b.recordedAt)
      if (sortBy === 'participant') return (a.participant?.name || '').localeCompare(b.participant?.name || '')
      return 0
    })

  const total = filtered.length
  const totalPages = Math.ceil(total / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const totalCount = recordings.length
  const readyCount = recordings.filter((r) => r.status === 'ready').length
  const processingCount = recordings.filter((r) => r.status === 'processing').length

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 4, fontWeight: 500 }}>
            Trainer Portal › Assessments › Recordings
          </p>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827', fontFamily: "'Poppins', sans-serif" }}>
            Assessment Recordings
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            View session recordings from quiz and coding assessments
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Monitor size={18} style={{ color: '#9CA3AF' }} />
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Recordings</div>
          <div className="stat-value">{totalCount}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Ready to Watch</div>
          <div className="stat-value">{readyCount}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">Processing</div>
          <div className="stat-value">{processingCount}</div>
        </div>
      </div>

      <motion.div variants={itemVariants} className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Filter size={14} style={{ color: '#6B7280' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Filters</span>
        </div>

        <div className="form-grid-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Search participant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: 36 }}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            className="form-control"
          >
            <option value="all">All Assessments</option>
            <option value="quiz">Quiz</option>
            <option value="coding">Coding Assessment</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="participant">By Participant Name</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={applySearch} className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>
            Apply Filters
          </button>
          <button onClick={clearSearch} className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>
            Clear
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Recordings ({total})</h3>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {typeFilter === 'all' && 'All quiz and coding assessment recordings'}
                {typeFilter === 'quiz' && 'Quiz session recordings'}
                {typeFilter === 'coding' && 'Coding assessment session recordings'}
              </span>
            </div>
          </div>

          {total === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎥</div>
              <h3>No Recordings Found</h3>
              <p>
                Recordings will appear here after participants complete your proctored assessment sessions with
                screen sharing enabled.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-y-3">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
                      <th className="py-4 px-5 text-left font-medium">Participant</th>
                      <th className="py-4 px-5 text-left font-medium">Assessment Title</th>
                      <th className="py-4 px-5 text-left font-medium">Date</th>
                      <th className="py-4 px-5 text-left font-medium">Duration</th>
                      <th className="py-4 px-5 text-left font-medium">Violations</th>
                      <th className="py-4 px-5 text-left font-medium">Score</th>
                      <th className="py-4 px-5 text-left font-medium">Status</th>
                      <th className="py-4 px-5 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((rec) => {
                      const pName = rec.participant?.name || `User #${rec.participantId}`
                      const pEmail = rec.participant?.email || ''
                      const aTitle = getAssessmentTitle(rec)
                      return (
                        <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {pName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800">{pName}</p>
                                {pEmail && <p className="text-xs text-gray-400">{pEmail}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 text-gray-600 max-w-[220px] truncate">{aTitle}</td>
                          <td className="py-4 px-5 text-gray-500 whitespace-nowrap">{formatDate(rec.recordedAt)}</td>
                          <td className="py-4 px-5 text-gray-500">{formatDuration(rec.durationSeconds)}</td>
                          <td className="py-4 px-5">
                            {rec.violationCount > 0 ? (
                              <span className="text-yellow-600 font-medium">⚠️ {rec.violationCount}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-gray-700 font-medium">{getScore(rec)}</td>
                          <td className="py-4 px-5">
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusBadgeClasses(
                                rec.status
                              )}`}
                            >
                              {rec.status === 'ready' ? 'Ready' : rec.status === 'processing' ? 'Processing' : 'Failed'}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <button
                              onClick={() => navigate(`/trainer/assessments/recordings/${rec.id}`)}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              <Play size={12} />
                              Watch
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Show Data</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setPage(1)
                      }}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="px-2 py-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      «
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2 py-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ‹
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                      const n =
                        totalPages <= 5
                          ? idx + 1
                          : page <= 3
                            ? idx + 1
                            : page >= totalPages - 2
                              ? totalPages - 4 + idx
                              : page - 2 + idx
                      return (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            n === page ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {n}
                        </button>
                      )
                    })}
                    {totalPages > 5 && page < totalPages - 2 && (
                      <>
                        <span className="px-2 text-gray-400 text-sm">...</span>
                        <button
                          onClick={() => setPage(totalPages)}
                          className="px-3 py-1 rounded text-gray-500 hover:bg-gray-100 text-sm"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-2 py-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ›
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="px-2 py-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      »
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
