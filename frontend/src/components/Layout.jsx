import { AnimatePresence, motion } from 'framer-motion'
import { Award, BookOpen, BookPlus, ClipboardList, Code, FileText, GraduationCap, Home, LayoutDashboard, LogOut, Menu, MessageSquare, Sparkles, Trophy, User, UserPlus, Users, X } from 'lucide-react'
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
    { key: 'pending', label: 'Pending Approval', icon: 'Overview' },
    { key: 'trainings', label: 'Trainings', icon: 'Trainings' },
    { key: 'trainers', label: 'Trainers', icon: 'Trainers' },
    { key: 'participants', label: 'Participants', icon: 'Participants' },
    { key: 'sessions', label: 'Sessions', icon: 'AI Quizzes' },
    { key: 'notes', label: 'Notes', icon: 'Lessons' },
    { key: 'feedback', label: 'Feedback', icon: 'Feedback' },
    { key: 'surveys', label: 'Surveys', icon: 'Surveys' },
  ],
  TRAINER: [
    { key: 'courses', label: 'Trainings', icon: 'Trainings' },
    { key: 'coding', label: 'Coding Tests', icon: 'Coding' },
    { key: 'feedback', label: 'Feedback', icon: 'Feedback' },
    { key: 'profile', label: 'My Profile', icon: 'My Profile' },
  ],
  PARTICIPANT: [
    { key: 'overview', label: 'Overview', icon: 'Overview' },
    { key: 'myEnrollments', label: 'My Trainings', icon: 'Trainings' },
    { key: 'lessons', label: 'Lessons', icon: 'Lessons' },
    { key: 'ai-quizzes', label: 'Quizzes', icon: 'AI Quizzes' },
    { key: 'coding', label: 'Coding Tests', icon: 'Coding' },
    { key: 'leaderboard', label: 'Leaderboard', icon: 'Leaderboard' },
    { key: 'achievements', label: 'Achievements', icon: 'Achievements' },
    { key: 'reports', label: 'My Reports', icon: 'Feedback' },
    { key: 'certificates', label: 'Certificates', icon: 'Achievements' },
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
    <div className={`app-layout${user.role === 'PARTICIPANT' || user.role === 'ADMIN' ? ' theme-academic' : ''}`}>
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
            <motion.button
              key={item.key}
              className={`sidebar-nav-item${activeTab === item.key ? ' active' : ''}`}
              onClick={() => { onTabChange(item.key); closeSidebar() }}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="nav-icon">
                {iconMap[item.icon]}
              </span>
              <span>{item.label}</span>
            </motion.button>
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
            <motion.div
              className="sidebar-user"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="sidebar-user-avatar">
                {initials(user.name)}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name}</div>
                <span className={`badge ${colors.badge}`} style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', textTransform: 'uppercase', marginTop: 2 }}>
                  {user.role}
                </span>
              </div>
              <button className="sidebar-logout-btn" onClick={onLogout} title="Sign Out">
                <LogOut size={14} />
              </button>
            </motion.div>
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
      <motion.main
        className="main-content"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="page-content">
          {children}
        </div>
      </motion.main>
    </div>
  )
}

export default Layout
