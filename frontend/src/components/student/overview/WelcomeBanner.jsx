import { motion } from 'framer-motion'
import { Flame, ArrowRight, Sparkles } from 'lucide-react'

function timeOfDayGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const initials = (name) =>
  name ? name.trim().split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'S'

/**
 * WelcomeBanner — minimalist hero for the student overview page.
 *
 * 2026-05-28 redesign — premium SaaS aesthetic. Two-column layout:
 *   left   = greeting kicker + prominent name + supporting line
 *   right  = subtle streak chip + primary CTA
 * Soft violet gradient surface, hairline border, layered shadow.
 */
export default function WelcomeBanner({
  user,
  streak = 0,
  enrollmentsCount = 0,
  onPrimaryAction,
  primaryActionLabel = 'Browse courses',
}) {
  const greeting = timeOfDayGreeting()
  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="ov-hero"
    >
      {/* Decorative violet bloom (top-right) */}
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
            {enrollmentsCount > 0
              ? `You're enrolled in ${enrollmentsCount} course${enrollmentsCount === 1 ? '' : 's'}. Keep your momentum going.`
              : "Let's get you started — pick a course or take a quick assessment."}
          </p>
        </div>

        <div className="ov-hero__right">
          {streak > 0 && (
            <div className="ov-hero__streak" title={`${streak}-day learning streak`}>
              <Flame size={14} aria-hidden />
              <span className="ov-hero__streak-value mono">{streak}</span>
              <span className="ov-hero__streak-label">day streak</span>
            </div>
          )}

          <div className="ov-hero__avatar" aria-hidden>
            {initials(user?.name)}
          </div>

          {onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="ov-hero__cta"
            >
              {primaryActionLabel}
              <ArrowRight size={14} className="ov-hero__cta-arrow" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </motion.section>
  )
}
