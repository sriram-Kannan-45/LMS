import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

import ProfileHero from './ProfileHero'
import ProfileMiniStats from './ProfileMiniStats'
import ProfileSkills from './ProfileSkills'
import ProfileLeaderboardBadge from './ProfileLeaderboardBadge'
import ProfileRecentActivity from './ProfileRecentActivity'
import ProfileAchievementsPreview from './ProfileAchievementsPreview'
import ProfileCourseProgress from './ProfileCourseProgress'
import ProfileQuickActions from './ProfileQuickActions'
import ProfileSettingsModal from './ProfileSettingsModal'
import ProfileSkeleton from './ProfileSkeleton'

import { useStudentStats } from '../../../hooks/useStudentStats'
import { useContinueLearning } from '../../../hooks/useContinueLearning'
import useParticipantProfile from '../../../hooks/useParticipantProfile'
import { useToast } from '../../Toast'

/**
 * ProfileSection — Full Dashboard View (v4 — light template restored).
 *
 * Layout zones:
 *   A. Identity card                         (full width, top)
 *   B. 4 stat cards                          (row, 4 cols)
 *   C. Left column (2/3)                     ↓
 *      C1. Skills earned
 *      C2. Achievements preview
 *      C3. Recent activity feed
 *   D. Right column (1/3)                    ↓
 *      D1. Leaderboard snapshot (rich)
 *      D2. Course progress
 *      D3. Quick actions
 */
export default function ProfileSection({
  user,
  enrollments = [],
  quizzes = [],
  onResume,
  onTabChange,
}) {
  const {
    profile, completion, initials,
    updateProfile, uploadAvatar, setAvatar, clearAvatar,
  } = useParticipantProfile(user)
  const { stats, loading } = useStudentStats()
  const { items: recentItems } = useContinueLearning()
  const { success, error: showError } = useToast()

  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    const handler = () => setEditOpen(true)
    window.addEventListener('wave:profile:edit', handler)
    return () => window.removeEventListener('wave:profile:edit', handler)
  }, [])

  const handleAvatarChange = useCallback(async (file) => {
    try { await setAvatar(file); success('Profile photo updated.') }
    catch (e) { showError(e?.message || 'Could not save photo') }
  }, [setAvatar, success, showError])

  const handleAvatarClear = useCallback(async () => {
    try { await clearAvatar(); success('Profile photo removed.') }
    catch (e) { showError(e?.message || 'Could not remove photo') }
  }, [clearAvatar, success, showError])

  const handleSaveProfile = useCallback(async (patch) => {
    try { await updateProfile(patch); success('Profile updated successfully.') }
    catch (e) { showError(e?.message || 'Could not save changes'); throw e }
  }, [updateProfile, success, showError])

  const closeEdit = useCallback(() => setEditOpen(false), [])

  // ── Derived metrics ───────────────────────────────────────────────────
  const totalQuizzes = stats?.totalQuizzes ?? 0
  const accuracy     = stats?.averageScore ?? 0
  const bestScore    = stats?.bestScore ?? 0
  const bestRank     = stats?.bestRank ?? null
  const xp           = totalQuizzes * 10 + Math.round(accuracy * 1.5)

  const certificates = useMemo(
    () => (stats?.breakdownByQuiz || []).filter((q) => (q.bestScore ?? 0) >= 70).length,
    [stats]
  )

  const trend = stats?.accuracyTrend || []
  const accuracyDelta =
    trend.length >= 2
      ? +(trend[trend.length - 1].score - trend[trend.length - 2].score).toFixed(1)
      : undefined

  const streak = useMemo(() => {
    const dates = new Set(trend.map((t) => t.date))
    let s = 0
    for (let i = 0; i < 90; i++) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (dates.has(key)) s++
      else if (i > 0) break
    }
    return s
  }, [trend])

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading && !stats) {
    return <ProfileSkeleton />
  }

  return (
    <motion.div
      className="profile-dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── ZONE A: Identity card ─────────────────────────────────── */}
      <ProfileHero
        user={user}
        profile={profile}
        completion={completion}
        initials={initials}
        onEdit={() => setEditOpen(true)}
        onAvatarChange={handleAvatarChange}
        onAvatarClear={handleAvatarClear}
      />

      {/* ── ZONE B: 4 stat cards ──────────────────────────────────── */}
      <div className="stats-row">
        <ProfileMiniStats
          totalQuizzes={totalQuizzes}
          accuracy={accuracy}
          xp={xp}
          certificates={certificates}
          accuracyDelta={accuracyDelta}
          onTabChange={onTabChange}
        />
      </div>

      {/* ── ZONES C + D: Two-column main row ──────────────────────── */}
      <div className="main-row">
        {/* LEFT COLUMN (2/3) */}
        <div className="left-col">
          <ProfileSkills
            skills={profile?.skills || []}
            onAdd={() => setEditOpen(true)}
          />

          <ProfileAchievementsPreview
            stats={stats}
            enrollmentsCount={enrollments.length}
            streak={streak}
            onSeeAll={onTabChange ? () => onTabChange('achievements') : undefined}
          />

          <ProfileRecentActivity
            items={recentItems}
            stats={stats}
            onResume={onResume}
            onTabChange={onTabChange}
          />
        </div>

        {/* RIGHT COLUMN (1/3) */}
        <div className="right-col">
          <ProfileLeaderboardBadge
            user={user}
            rank={bestRank}
            bestScore={bestScore}
            averageScore={accuracy}
            onViewFull={onTabChange ? () => onTabChange('leaderboard') : undefined}
          />

          <ProfileCourseProgress
            enrollments={enrollments}
            onTabChange={onTabChange}
          />

          <ProfileQuickActions onTabChange={onTabChange} />
        </div>
      </div>

      {/* SETTINGS MODAL */}
      <ProfileSettingsModal
        open={editOpen}
        onClose={closeEdit}
        profile={profile}
        user={user}
        initials={initials}
        onSave={handleSaveProfile}
        onAvatarUpload={uploadAvatar}
        onAvatarClear={clearAvatar}
      />
    </motion.div>
  )
}
