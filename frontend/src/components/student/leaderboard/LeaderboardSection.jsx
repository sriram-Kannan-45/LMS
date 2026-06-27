import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy, RefreshCw, Search, Sparkles, TrendingUp,
  Award, Crown,
} from 'lucide-react'
import { useLeaderboard } from '../../../hooks/useLeaderboard'
import { useSocket } from '../../../hooks/useSocket'
import PodiumTop3 from './PodiumTop3'
import LeaderRow from './LeaderRow'
import LiveBadge from './LiveBadge'

const SCOPES = [
  { key: 'global',   label: 'All quizzes' },
  { key: 'training', label: 'By course' },
  { key: 'quiz',     label: 'By quiz' },
]

const initials = (name) =>
  name ? name.trim().split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?'

/**
 * LeaderboardSection — premium gamified leaderboard (2026-05-28 redesign).
 *
 *   1. Hero with violet bloom + scope tabs + Live badge.
 *   2. Personal performance panel (rank · percentile · score · gap-to-leader).
 *   3. Modern podium (2-1-3 layout, gold/silver/bronze).
 *   4. Glassmorphism search.
 *   5. Modern leaderboard rows with progress bars.
 */
export default function LeaderboardSection({ enrollments = [], quizzes = [], currentUserId }) {
  const [scope, setScope] = useState('global')
  const [scopeId, setScopeId] = useState(null)
  const [search, setSearch] = useState('')

  const { entries, loading, error, lastUpdated, refetch } = useLeaderboard({
    scope, id: scopeId, live: true,
  })
  const { isConnected } = useSocket()

  const onScopeChange = (next) => {
    setScope(next)
    if (next === 'global') setScopeId(null)
    else if (next === 'training') setScopeId(enrollments[0]?.trainingId ?? null)
    else if (next === 'quiz') setScopeId(quizzes[0]?.id ?? null)
  }

  const filtered = useMemo(() => {
    if (!search) return entries
    const q = search.toLowerCase()
    return entries.filter((e) => e.name?.toLowerCase().includes(q))
  }, [entries, search])

  const top3 = filtered.slice(0, 3)
  const rest = filtered.slice(3)
  const totalCount = entries.length
  const myEntry = entries.find((e) => e.isCurrentUser || e.userId === currentUserId)

  // Honest derived metrics — only what the data supports
  const myPercentile =
    myEntry && totalCount > 0
      ? Math.round(((totalCount - myEntry.rank + 1) / totalCount) * 100)
      : null
  const leaderScore = entries[0]?.score ?? null
  const myGap =
    myEntry && leaderScore != null && myEntry.rank > 1
      ? Math.max(0, +(leaderScore - (myEntry.score || 0)).toFixed(1))
      : null

  const scopeLabel = SCOPES.find((s) => s.key === scope)?.label || 'All quizzes'

  return (
    <div className="lb-shell">
      {/* ─── Hero ─────────────────────────────────────────────────── */}
      <header className="lb-hero">
        <span className="lb-hero__bloom" aria-hidden />
        <span className="lb-hero__bloom lb-hero__bloom--right" aria-hidden />

        <div className="lb-hero__inner">
          <div className="lb-hero__text">
            <span className="lb-hero__kicker">
              <Sparkles size={11} strokeWidth={2.5} aria-hidden /> Performance ranking
            </span>
            <h1 className="lb-hero__title">
              <span className="lb-hero__title-trophy" aria-hidden>
                <Trophy size={28} strokeWidth={2} />
              </span>
              Leaderboard
            </h1>
            <p className="lb-hero__subtitle">
              {totalCount > 0
                ? `${totalCount} learner${totalCount === 1 ? '' : 's'} ranked across ${scopeLabel.toLowerCase()}. Climb the ranks by topping quizzes.`
                : 'Be the first to take a quiz and claim the top spot!'}
            </p>
          </div>

          <div className="lb-hero__actions">
            <LiveBadge connected={isConnected} />
            <button type="button" onClick={refetch} className="lb-hero__refresh" aria-label="Refresh leaderboard">
              <RefreshCw size={13} className={loading ? 'lb-spin' : ''} aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        {/* Scope tabs (segmented) */}
        <div className="lb-scope" role="tablist" aria-label="Leaderboard scope">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={scope === s.key}
              onClick={() => onScopeChange(s.key)}
              className="lb-scope__tab"
              data-active={scope === s.key ? 'true' : 'false'}
            >
              {s.label}
            </button>
          ))}

          {scope === 'training' && enrollments.length > 0 && (
            <select
              value={scopeId ?? ''}
              onChange={(e) => setScopeId(e.target.value || null)}
              className="lb-scope__select"
              aria-label="Pick a course"
            >
              {enrollments.map((e) => (
                <option key={e.id} value={e.trainingId}>{e.trainingTitle}</option>
              ))}
            </select>
          )}
          {scope === 'quiz' && quizzes.length > 0 && (
            <select
              value={scopeId ?? ''}
              onChange={(e) => setScopeId(e.target.value || null)}
              className="lb-scope__select"
              aria-label="Pick a quiz"
            >
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* ─── Personal performance panel (only if user is on the board) ─── */}
      {myEntry && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lb-mestat"
          aria-label="Your performance"
        >
          <div className="lb-mestat__id">
            <div className="lb-mestat__avatar" aria-hidden>
              {initials(myEntry.name)}
            </div>
            <div className="lb-mestat__id-text">
              <span className="lb-mestat__id-label">Your performance</span>
              <span className="lb-mestat__id-name">{myEntry.name}</span>
            </div>
          </div>

          <div className="lb-mestat__cells">
            <div className="lb-mestat__cell">
              <span className="lb-mestat__cell-label">Rank</span>
              <span className="lb-mestat__cell-value mono">
                <span className="lb-mestat__hash">#</span>{myEntry.rank}
                <span className="lb-mestat__cell-sub">of {totalCount}</span>
              </span>
            </div>
            <span className="lb-mestat__divider" aria-hidden />
            <div className="lb-mestat__cell">
              <span className="lb-mestat__cell-label">Percentile</span>
              <span className="lb-mestat__cell-value mono">
                {myPercentile != null ? `${myPercentile}` : '—'}
                {myPercentile != null && <span className="lb-mestat__cell-sub">th</span>}
              </span>
            </div>
            <span className="lb-mestat__divider" aria-hidden />
            <div className="lb-mestat__cell">
              <span className="lb-mestat__cell-label">Score</span>
              <span className="lb-mestat__cell-value mono">
                {myEntry.score?.toFixed(1)}<span className="lb-mestat__cell-sub">%</span>
              </span>
            </div>
            <span className="lb-mestat__divider" aria-hidden />
            <div className="lb-mestat__cell">
              <span className="lb-mestat__cell-label">
                {myEntry.rank === 1 ? 'Status' : 'Gap to leader'}
              </span>
              <span
                className="lb-mestat__cell-value mono"
                data-tone={myEntry.rank === 1 ? 'gold' : 'neutral'}
              >
                {myEntry.rank === 1 ? (
                  <>
                    <Crown size={14} strokeWidth={2.2} fill="#fbbf24" stroke="#f59e0b" /> Leader
                  </>
                ) : myGap != null ? (
                  <>
                    <TrendingUp size={12} strokeWidth={2.5} aria-hidden />
                    {myGap}<span className="lb-mestat__cell-sub">%</span>
                  </>
                ) : '—'}
              </span>
            </div>
          </div>
        </motion.section>
      )}

      {/* ─── Loading skeleton ───────────────────────────────────────── */}
      {loading && entries.length === 0 && (
        <div className="lb-card lb-card--podium">
          <div className="lb-podium-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="lb-podium-card" style={{ opacity: 0.5 }}>
                <div className="ac-skeleton" style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px' }} />
                <div className="ac-skeleton" style={{ width: '70%', height: 14, margin: '0 auto 8px' }} />
                <div className="ac-skeleton" style={{ width: '40%', height: 22, margin: '0 auto' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Empty state ─────────────────────────────────────────── */}
      {!loading && entries.length === 0 && !error && (
        <div className="lb-empty">
          <div className="lb-empty__icon" aria-hidden>
            <Trophy size={28} />
          </div>
          <h3 className="lb-empty__title">No rankings yet</h3>
          <p className="lb-empty__desc">
            Be the first to take a quiz and claim the top spot.
          </p>
        </div>
      )}

      {/* ─── Podium ──────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="lb-card lb-card--podium"
        >
          <div className="lb-podium-header">
            <h2 className="lb-podium-title">
              <Award size={15} strokeWidth={2.25} aria-hidden /> Top performers
            </h2>
            <span className="lb-podium-count mono">{Math.min(3, entries.length)} of {totalCount}</span>
          </div>
          <PodiumTop3 entries={top3} />
        </motion.section>
      )}

      {/* ─── Filter bar (search) ─────────────────────────────────── */}
      {entries.length > 3 && (
        <section className="lb-filters" aria-label="Search leaderboard">
          <div className="lb-search">
            <Search size={15} className="lb-search__icon" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search learner by name…"
              aria-label="Search leaderboard"
              className="lb-search__input"
            />
          </div>
          <div className="lb-filters__count mono">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </div>
        </section>
      )}

      {/* ─── Full ranking table ─────────────────────────────────── */}
      {rest.length > 0 && (
        <section className="lb-card lb-card--table" aria-label="Full ranking">
          <div className="lb-table-head">
            <div className="lb-table-head__rank">Rank</div>
            <div className="lb-table-head__user">Learner</div>
            <div className="lb-table-head__score">Score</div>
            <div className="lb-table-head__accuracy">Accuracy</div>
            <div className="lb-table-head__time">Time</div>
          </div>
          <div role="list">
            <AnimatePresence initial={false}>
              {rest.map((entry, i) => (
                <LeaderRow
                  key={`${entry.userId}-${entry.rank}`}
                  entry={entry}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </div>
          {filtered.length === 0 && (
            <div className="lb-table-empty">No matches for "{search}".</div>
          )}
        </section>
      )}

      {/* ─── Last updated footer ─────────────────────────────────── */}
      {lastUpdated && entries.length > 0 && (
        <p className="lb-footer">
          Last updated {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}

      {/* ─── Error banner ────────────────────────────────────────── */}
      {error && (
        <div className="lb-error" role="alert">{error}</div>
      )}
    </div>
  )
}
