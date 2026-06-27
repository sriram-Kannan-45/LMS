import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, User as UserIcon, Settings, Award, BookOpen,
  Trophy, LogOut,
} from 'lucide-react'
import useParticipantProfile from '../../../hooks/useParticipantProfile'
import { assetUrl } from '../../../api/api'

/**
 * ProfileDropdown — compact avatar+name button in the page header that opens
 * an animated menu with quick-links into the dashboard tabs.
 *
 * Props:
 *   user           — auth user
 *   onTabChange    — fn(tabKey) → switch dashboard tab
 *   onLogout       — fn()
 *   onOpenSettings — fn() → optional, opens edit-profile modal externally
 */
export default function ProfileDropdown({ user, onTabChange, onLogout, onOpenSettings }) {
  const { profile, initials } = useParticipantProfile(user)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (tab) => {
    onTabChange?.(tab)
    setOpen(false)
  }

  // Open the Edit Profile modal owned by <ProfileSection />. We can't pass
  // props directly because the dropdown lives in <Layout>, not inside the
  // section. A custom event keeps this loose-coupled and works regardless
  // of which dashboard tab is currently mounted (we navigate first, then
  // dispatch on the next tick so the section is mounted to receive it).
  const openEditProfile = () => {
    onTabChange?.('profile')
    setOpen(false)
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('wave:profile:edit'))
    }, 150)
  }

  const displayName = profile?.displayName || user?.name || 'Participant'

  return (
    <div ref={wrapRef} className="pf-dd">
      <button
        type="button"
        className="pf-dd__trigger"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <span className="pf-dd__avatar">
          {profile?.avatarUrl ? (
            <img src={assetUrl(profile.avatarUrl)} alt={`${displayName}'s avatar`} />
          ) : (
            <span>{initials}</span>
          )}
        </span>
        <span className="pf-dd__name">{displayName}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ display: 'inline-flex', color: 'var(--academic-text-muted)' }}
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            role="menu"
            className="pf-dd__menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="pf-dd__header">
              <span className="pf-dd__avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                {profile?.avatarUrl ? (
                  <img src={assetUrl(profile.avatarUrl)} alt="" />
                ) : (
                  <span>{initials}</span>
                )}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="pf-dd__header-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                {user?.email && (
                  <div className="pf-dd__header-email" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                )}
              </div>
            </div>

            <button role="menuitem" type="button" className="pf-dd__item" onClick={() => go('profile')}>
              <UserIcon size={15} /> View profile
            </button>
            <button role="menuitem" type="button" className="pf-dd__item" onClick={() => { onOpenSettings ? onOpenSettings() : openEditProfile() }}>
              <Settings size={15} /> Edit profile
            </button>
            <button role="menuitem" type="button" className="pf-dd__item" onClick={() => go('myEnrollments')}>
              <BookOpen size={15} /> My courses
            </button>
            <button role="menuitem" type="button" className="pf-dd__item" onClick={() => go('achievements')}>
              <Award size={15} /> Achievements
            </button>
            <button role="menuitem" type="button" className="pf-dd__item" onClick={() => go('leaderboard')}>
              <Trophy size={15} /> Leaderboard
            </button>

            {onLogout && (
              <>
                <div className="pf-dd__sep" />
                <button
                  role="menuitem"
                  type="button"
                  className="pf-dd__item pf-dd__item--danger"
                  onClick={() => { setOpen(false); onLogout() }}
                >
                  <LogOut size={15} /> Sign out
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
