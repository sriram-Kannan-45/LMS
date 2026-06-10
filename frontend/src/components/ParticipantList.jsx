import React, { useState, useMemo, useCallback, memo } from 'react'
import { Search, Trash2, Eye, Phone, Calendar, Edit2, Check, X, ShieldAlert } from 'lucide-react'
import StatusBadge from './StatusBadge'
import SkeletonCard from './SkeletonCard'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ParticipantList Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800" role="alert">
          <h3 className="font-semibold mb-1">Error Loading Participants</h3>
          <p className="text-sm">{this.state.error?.message || 'An unexpected error occurred'}</p>
        </div>
      )
    }
    return this.props.children
  }
}

function ParticipantList({ 
  participants = [], 
  loading = false, 
  onDelete = null, 
  onRefresh = null, 
  onView = null,
  onApprove = null,
  onReject = null 
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [editingParticipant, setEditingParticipant] = useState(null)
  const [editStatus, setEditStatus] = useState('')
  const itemsPerPage = 10

  const getInitials = useCallback((name) => {
    if (!name) return '?'
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }, [])

  const counts = useMemo(() => {
    const res = { all: participants.length, APPROVED: 0, PENDING: 0, REJECTED: 0 }
    participants.forEach(p => {
      const status = (p.status || '').toUpperCase()
      if (status === 'APPROVED') res.APPROVED++
      if (status === 'PENDING') res.PENDING++
      if (status === 'REJECTED') res.REJECTED++
    })
    return res
  }, [participants])

  const filteredItems = useMemo(() => {
    return participants.filter(p => {
      const matchesSearch = !searchTerm || 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.includes(searchTerm)
      
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [participants, searchTerm, statusFilter])

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const paginatedItems = filteredItems.slice(startIdx, startIdx + itemsPerPage)

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }, [])

  const handlePreviousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }, [totalPages])

  const handleDelete = useCallback((id, name) => {
    if (onDelete) {
      onDelete(id, name)
    }
  }, [onDelete])

  const handleSaveStatus = async () => {
    if (!editingParticipant) return
    try {
      if (editStatus === 'APPROVED' && editingParticipant.status !== 'APPROVED') {
        if (onApprove) await onApprove(editingParticipant.id)
      } else if (editStatus === 'REJECTED' && editingParticipant.status !== 'REJECTED') {
        if (onReject) await onReject(editingParticipant.id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setEditingParticipant(null)
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading participants">
        <SkeletonCard variant="card" count={5} />
      </div>
    )
  }

  if (!participants || participants.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900/30 rounded-2xl border border-slate-200/60 dark:border-zinc-800/60" role="status" aria-live="polite">
        <div className="text-4xl mb-3" aria-hidden="true">👥</div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">No Participants Yet</h3>
        <p className="text-slate-500 mb-4">Participants will appear here once they register.</p>
        {onRefresh && (
          <button 
            onClick={onRefresh}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition cursor-pointer text-sm font-semibold"
            aria-label="Refresh participant list"
          >
            Refresh List
          </button>
        )}
      </div>
    )
  }

  const resultsMessage = `Showing ${paginatedItems.length} of ${filteredItems.length} participants`

  return (
    <div className="space-y-4">
      {/* Toolbar: Search box & Segmented Filter Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <label htmlFor="participant-search" className="sr-only">Search participants</label>
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <input
            id="participant-search"
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/60 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all duration-200 text-sm shadow-sm"
            aria-label="Search participants by name, email, or phone"
          />
        </div>

        {/* Segmented Filter Pills */}
        <div className="tabs-pills flex items-center gap-1" style={{ marginBottom: 0 }}>
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'APPROVED', label: 'Approved', count: counts.APPROVED },
            { key: 'PENDING', label: 'Pending', count: counts.PENDING },
            { key: 'REJECTED', label: 'Rejected', count: counts.REJECTED }
          ].map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={() => { setStatusFilter(chip.key); setCurrentPage(1) }}
              className={`tab-pill flex items-center gap-1.5 px-3 py-1.5 cursor-pointer ${
                statusFilter === chip.key ? 'active' : ''
              }`}
            >
              <span>{chip.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold transition-colors duration-200 ${
                statusFilter === chip.key
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400'
              }`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div 
        id="search-results" 
        className="text-xs text-slate-500 dark:text-slate-400 font-semibold pl-1 pb-1"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {resultsMessage}
      </div>

      {/* Participant Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Avatar</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Registration Date</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 flex items-center justify-center text-xs font-bold border border-violet-200/30 dark:border-violet-800/30 flex-shrink-0">
                    {getInitials(p.name)}
                  </div>
                </td>
                <td className="font-semibold text-slate-800 dark:text-slate-100">{p.name || '-'}</td>
                <td className="text-slate-600 dark:text-slate-400">{p.email}</td>
                <td className="text-slate-600 dark:text-slate-400">{p.phone || '-'}</td>
                <td className="text-slate-600 dark:text-slate-400">
                  {new Date(p.created_at || p.joinedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td>
                  <StatusBadge status={p.status || 'PENDING'} size="sm" />
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {onView && (
                      <button
                        onClick={() => onView(p)}
                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer relative"
                        title="View Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => { setEditingParticipant(p); setEditStatus(p.status || 'PENDING') }}
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer"
                      title="Edit Status"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer"
                        title="Remove Participant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex justify-center items-center gap-2 mt-8 animate-fade-in" aria-label="Pagination">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm border border-slate-200 dark:border-zinc-800 rounded-xl disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition duration-200 cursor-pointer font-semibold text-slate-600 dark:text-slate-400"
            aria-label="Previous page"
          >
            Previous
          </button>
          
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold px-3" role="status">
            Page <span aria-current="page">{currentPage}</span> of {totalPages}
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm border border-slate-200 dark:border-zinc-800 rounded-xl disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-zinc-800 transition duration-200 cursor-pointer font-semibold text-slate-600 dark:text-slate-400"
            aria-label="Next page"
          >
            Next
          </button>
        </nav>
      )}

      {/* Edit Status Modal */}
      {editingParticipant && (
        <div className="modal-overlay" onClick={() => setEditingParticipant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Manage Participant Status</h3>
              <button className="modal-close" onClick={() => setEditingParticipant(null)}>×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-150 dark:border-zinc-800/60">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 flex items-center justify-center font-bold text-sm">
                  {getInitials(editingParticipant.name)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{editingParticipant.name}</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{editingParticipant.email}</p>
                </div>
              </div>

              <div className="form-group mt-4">
                <label className="form-label">Account Status</label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus('APPROVED')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      editStatus === 'APPROVED'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <Check className="w-4 h-4" /> Approved
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus('REJECTED')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      editStatus === 'REJECTED'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <X className="w-4 h-4" /> Rejected
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 mt-6 justify-end">
                <button 
                  type="button" 
                  className="px-4 py-2 border border-slate-250 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-bold cursor-pointer"
                  onClick={() => setEditingParticipant(null)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                  onClick={handleSaveStatus}
                >
                  Save Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(ParticipantList)
