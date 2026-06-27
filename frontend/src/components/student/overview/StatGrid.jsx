import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Trophy, Target, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (target == null || isNaN(target)) { setValue(0); return }
    const start = performance.now()
    const from = fromRef.current
    let raf
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

/**
 * StatCard — minimal premium SaaS stat tile.
 *
 * Layout:  small label · subtle icon
 *          Big monospace value
 *          Helper line (optional trend chip)
 */
function StatCard({ icon: Icon, label, value, suffix = '', loading = false, helper, trend = null, delay = 0 }) {
  const counted = useCountUp(typeof value === 'number' ? value : 0)
  const display = typeof value === 'number'
    ? (suffix === '%' ? counted.toFixed(1) : Math.round(counted).toLocaleString())
    : (value ?? '—')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className="ov-stat"
    >
      <div className="ov-stat__head">
        <span className="ov-stat__label">{label}</span>
        <span className="ov-stat__icon" aria-hidden>
          <Icon size={14} strokeWidth={2} />
        </span>
      </div>

      <div className="ov-stat__value mono">
        {loading ? (
          <span className="ac-skeleton" style={{ display: 'inline-block', width: 80, height: 32 }} />
        ) : (
          <>{display}<span className="ov-stat__suffix">{suffix}</span></>
        )}
      </div>

      <div className="ov-stat__foot">
        {trend != null && !loading && (
          <span
            className="ov-stat__trend"
            data-direction={trend >= 0 ? 'up' : 'down'}
          >
            {trend >= 0 ? <ArrowUpRight size={11} aria-hidden /> : <ArrowDownRight size={11} aria-hidden />}
            <span className="mono">{Math.abs(trend).toFixed(1)}%</span>
          </span>
        )}
        {helper && <span className="ov-stat__helper">{helper}</span>}
      </div>
    </motion.div>
  )
}

/**
 * StatGrid — 4 quiz analytics tiles. Same data contract as before
 * (totalQuizzes / averageScore / bestRank / accuracyTrend).
 */
export default function StatGrid({ stats, loading }) {
  const totalQuizzes = stats?.totalQuizzes ?? 0
  const averageScore = stats?.averageScore ?? 0
  const bestRank     = stats?.bestRank ?? null
  const trend        = stats?.accuracyTrend ?? []

  let trendDelta = null
  if (trend.length >= 2) {
    trendDelta = +(trend[trend.length - 1].score - trend[trend.length - 2].score).toFixed(1)
  }

  return (
    <div className="ov-stat-grid">
      <StatCard
        icon={BookOpen}
        label="Total quizzes"
        value={totalQuizzes}
        loading={loading}
        helper={totalQuizzes ? 'attempts in total' : 'no quizzes yet'}
        delay={0}
      />
      <StatCard
        icon={Target}
        label="Average score"
        value={averageScore}
        suffix="%"
        loading={loading}
        helper="across all attempts"
        delay={0.06}
      />
      <StatCard
        icon={Trophy}
        label="Best rank"
        value={bestRank ?? '—'}
        loading={loading}
        helper={bestRank ? 'leaderboard position' : 'take a quiz to rank'}
        delay={0.12}
      />
      <StatCard
        icon={TrendingUp}
        label="Recent trend"
        value={trendDelta != null ? Math.abs(trendDelta) : '—'}
        suffix={trendDelta != null ? '%' : ''}
        trend={trendDelta}
        loading={loading}
        helper={trend.length < 2 ? 'need 2+ attempts' : trendDelta >= 0 ? "you're improving" : 'slight dip'}
        delay={0.18}
      />
    </div>
  )
}
