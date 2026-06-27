export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDuration(s) {
  if (!s && s !== 0) return '—'
  const minutes = Math.floor(s / 60)
  const seconds = s % 60
  return `${minutes}m ${seconds}s`
}

export function getAssessmentTitle(rec) {
  return (
    rec?.codingAssessment?.title ||
    rec?.assessment?.title ||
    rec?.quiz?.title ||
    `Assessment #${rec?.assessmentId || rec?.id || ''}`
  )
}

export function getScore(rec) {
  const score = rec?.codingAttempt?.totalScore
  if (score === null || score === undefined || score === '') return '—'
  return String(score)
}

export function getStatusBadgeClasses(status) {
  if (status === 'ready') return 'bg-green-50 text-green-700 border-green-200'
  if (status === 'processing') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  return 'bg-red-50 text-red-600 border-red-200'
}

export function buildApiUrl(base, type) {
  if (!type || type === 'all') return base
  return `${base}?type=${encodeURIComponent(type)}`
}
