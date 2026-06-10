import { AnimatePresence, motion } from 'framer-motion'
import { Award, BookOpen, BookPlus, ClipboardList, Code, FileText, GraduationCap, Home, LayoutDashboard, LogOut, Menu, MessageSquare, Trophy, User, UserPlus, Users, X } from 'lucide-react'
import { useState } from 'react'
import ProfileDropdown from './student/profile/ProfileDropdown'

const iconMap = {
  Dashboard: <LayoutDashboard size={18} />,
  Trainings: <BookOpen size={18} />,
  Courses: <GraduationCap size={18} />,
  Trainers: <Users size={18} />,
  Participants: <Users size={18} />,
  Feedback: <MessageSquare size={18} />,
  Surveys: <ClipboardList size={18} />,
  'Add Trainer': <UserPlus size={18} />,
  'Add Training': <BookPlus size={18} />,
  'My Trainings': <BookOpen size={18} />,
  'My Courses': <GraduationCap size={18} />,
  'My Profile': <User size={18} />,
  Available: <BookOpen size={18} />,
  Enrollments: <BookPlus size={18} />,
  'Give Feedback': <MessageSquare size={18} />,
  'My Feedbacks': <MessageSquare size={18} />,
  'AI Quizzes': <Sparkles size={18} />,
  Overview: <Home size={18} />,
  Leaderboard: <Trophy size={18} />,
  Achievements: <Award size={18} />,
  Lessons: <FileText size={18} />,
  Coding: <Code size={18} />,
  Profile: <User size={18} />,
  ClipboardList: <ClipboardList size={18} />,
  FileText: <FileText size={18} />,
  Notes: <FileText size={18} />,
}

const navItems = {
  ADMIN: [
    { key: 'overview', label: 'Dashboard', icon: 'Dashboard' },
    { key: 'programs', label: 'Programs & Courses', icon: 'Courses' },
    { key: 'pending', label: 'Pending Approval', icon: 'Overview' },
    { key: 'trainings', label: 'Trainings', icon: 'Trainings' },
    { key: 'trainers', label: 'Trainers', icon: 'Trainers' },
    { key: 'participants', label: 'Participants', icon: 'Participants' },
    { key: 'sessions', label: 'Sessions', icon: 'AI Quizzes' },
    { key: 'notes', label: 'Notes', icon: 'Lessons' },
    { key: 'feedback', label: 'Feedback', icon: 'Feedback' },
    { key: 'surveys', label: 'Surveys', icon: 'Surveys' },
    { key: 'createTrainer', label: 'Add Trainer', icon: 'Add Trainer' },
    { key: 'createTraining', label: 'Add Training', icon: 'Add Training' },
  ],
  TRAINER: [
    { key: 'courses', label: 'My Courses', icon: 'My Courses' },
    { key: 'trainings', label: 'My Trainings', icon: 'My Trainings' },
    { key: 'coding', label: 'Coding Tests', icon: 'Coding' },
    { key: 'feedback', label: 'Feedback', icon: 'Feedback' },
    { key: 'profile', label: 'My Profile', icon: 'My Profile' },
  ],
  PARTICIPANT: [
    { key: 'overview', label: 'Overview', icon: 'Overview' },
    { key: 'available', label: 'Courses', icon: 'Available' },
    { key: 'myEnrollments', label: 'My Courses', icon: 'Enrollments' },
    { key: 'lessons', label: 'Lessons', icon: 'Lessons' },
    { key: 'ai-quizzes', label: 'Quizzes', icon: 'AI Quizzes' },
    { key: 'coding', label: 'Coding Tests', icon: 'Coding' },
    { key: 'leaderboard', label: 'Leaderboard', icon: 'Leaderboard' },
    { key: 'achievements', label: 'Achievements', icon: 'Achievements' },
    { key: 'feedback', label: 'Give Feedback', icon: 'Give Feedback' },
    { key: 'myFeedbacks', label: 'My Feedbacks', icon: 'My Feedbacks' },
    { key: 'profile', label: 'Profile', icon: 'Profile' },
  ],
}

const roleColors = {
  ADMIN: { gradient: 'from-rose-500 to-orange-500', badge: 'bg-rose-100 text-rose-700' },
  TRAINER: { gradient: 'from-emerald-500 to-teal-500', badge: 'bg-emerald-100 text-emerald-700' },
  PARTICIPANT: { gradient: 'from-blue-500 to-indigo-500', badge: 'bg-blue-100 text-blue-700' },
}

function Layout({ user, children, activeTab, onTabChange, onLogout, headerSlot }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const items = navItems[user.role] || []
  const colors = roleColors[user.role] || roleColors.PARTICIPANT
  const isParticipant = user.role === 'PARTICIPANT'

  const initials = (name) =>
    name ? name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className={`app-layout${isParticipant ? ' theme-academic' : ''}`}>
      {/* Sidebar Overlay (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sidebar-overlay open"
            onClick={closeSidebar}
            style={{ display: 'block' }}
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo Header */}
        <div className="sidebar-header">
          <motion.div 
            whileHover={{ scale: 1.08, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="sidebar-logo"
          >
            W
          </motion.div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">WAVE INIT</span>
            <span className="sidebar-brand-tagline">Learning Management</span>
          </div>
          {/* Mobile close button */}
          <button
            className="sidebar-close-btn"
            onClick={closeSidebar}
            style={{
              marginLeft: 'auto',
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-label">Navigation</div>
          {items.map((item) => (
            <button
              key={item.key}
              className={`sidebar-nav-item${activeTab === item.key ? ' active' : ''}`}
              onClick={() => { onTabChange(item.key); closeSidebar() }}
            >
              <span className="nav-icon">
                {iconMap[item.icon]}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer — user profile only */}
        <div className="sidebar-footer">
          {isParticipant ? (
            <ProfileDropdown
              user={user}
              onTabChange={onTabChange}
              onLogout={onLogout}
            />
          ) : (
            <div className="sidebar-user" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px' }}>
              <div className="sidebar-user-avatar">
                {initials(user.name)}
              </div>
              <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="sidebar-user-name" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</div>
                <span className={`badge ${colors.badge}`} style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', textTransform: 'uppercase', marginTop: 1 }}>
                  {user.role}
                </span>
              </div>
              <button className="sidebar-logout-btn" onClick={onLogout} title="Sign Out">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Floating Mobile Sidebar Toggle Button */}
      {!sidebarOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mobile-sidebar-toggle"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </motion.button>
      )}

      {/* Main Content */}
      <main className="main-content">
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout