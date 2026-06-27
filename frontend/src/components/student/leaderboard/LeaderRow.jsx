import { motion } from 'framer-motion'
import { Clock, Target, Hash } from 'lucide-react'

const initials = (name) =>
  name ? name.trim().split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?'

const fmtTime = (sec) => {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * LeaderRow — modern leaderboard row (rank 4+).
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ #4  [DM] Demo  ━━━━━━━━━━━━ 78.4%  92%  3:24  YOU    │
 *   └──────────────────────────────────────────────────────┘
 */
export default function LeaderRow({ entry, index = 0 }) {
  const isYou = entry.isCurrentUser
  const pct = Math.max(0, Math.min(100, entry.score || 0))

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.025, 0.3) }}
      tabIndex={0}
      role="listitem"
      aria-label={`Rank ${entry.rank}, ${entry.name}, score ${entry.score?.toFixed(1)}%`}
      className="lb-row"
      data-you={isYou ? 'true' : 'false'}
    >
      {/* Rank */}
      <div className="lb-row__rank">
        <span className="lb-row__rank-hash" aria-hidden>
          <Hash size={11} strokeWidth={2.25} />
        </span>
        <span className="lb-row__rank-value mono">{entry.rank}</span>
      </div>

      {/* Avatar + name + bar */}
      <div className="lb-row__user">
        <div className="lb-row__avatar" aria-hidden>
          {initials(entry.name)}
        </div>
        <div className="lb-row__user-meta">
          <div className="lb-row__user-line">
            <span className="lb-row__name" title={entry.name}>
              {entry.name}
            </span>
            {isYou && <span className="lb-row__you-pill">YOU</span>}
          </div>
          <div className="lb-row__bar" aria-hidden>
            <motion.div
              className="lb-row__bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, delay: Math.min(index * 0.025 + 0.1, 0.4), ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="lb-row__score">
        <span className="lb-row__score-value mono">{entry.score?.toFixed(1)}%</span>
      </div>

      {/* Accuracy */}
      <div className="lb-row__cell lb-row__cell--accuracy">
        <Target size={11} strokeWidth={2.25} aria-hidden />
        <span className="mono">{entry.accuracy != null ? `${entry.accuracy.toFixed(0)}%` : '—'}</span>
      </div>

      {/* Time */}
      <div className="lb-row__cell lb-row__cell--time">
        <Clock size={11} strokeWidth={2.25} aria-hidden />
        <span className="mono">{fmtTime(entry.timeTaken)}</span>
      </div>
    </motion.div>
  )
}
