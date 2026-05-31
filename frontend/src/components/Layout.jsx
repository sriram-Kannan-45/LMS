import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, GraduationCap, Users, MessageSquare, ClipboardList, UserPlus, BookPlus, BookOpen, User, LogOut, Menu, Bell, X, ChevronRight, Sparkles, Trophy, Award, FileText, Home } from 'lucide-react'
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
  Profile: <User size={18} />,
}

const navItems = {
  ADMIN: [
    { key: 'overview', label: 'Dashboard', icon: 'Dashboard' },
    { key: 'programs', label: 'Programs & Courses', icon: 'Courses' },
    { key: 'trainings', label: 'Trainings', icon: 'Trainings' },
    { key: 'trainers', label: 'Trainers', icon: 'Trainers' },
    { key: 'participants', label: 'Participants', icon: 'Participants' },
    { key: 'feedback', label: 'Feedback', icon: 'Feedback' },
    { key: 'surveys', label: 'Surveys', icon: 'Surveys' },
    { key: 'createTrainer', label: 'Add Trainer', icon: 'Add Trainer' },
    { key: 'createTraining', label: 'Add Training', icon: 'Add Training' },
  ],
  TRAINER: [
    { key: 'courses', label: 'My Courses', icon: 'My Courses' },
    { key: 'trainings', label: 'My Trainings', icon: 'My Trainings' },
    { key: 'feedback', label: 'Feedback', icon: 'Feedback' },
    { key: 'profile', label: 'My Profile', icon: 'My Profile' },
  ],
  PARTICIPANT: [
    { key: 'overview', label: 'Overview', icon: 'Overview' },
    { key: 'available', label: 'Courses', icon: 'Available' },
    { key: 'myEnrollments', label: 'My Courses', icon: 'Enrollments' },
    { key: 'lessons', label: 'Lessons', icon: 'Lessons' },
    { key: 'ai-quizzes', label: 'Quizzes', icon: 'AI Quizzes' },
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
          {items.map((item, index) => (
            <motion.button
              key={item.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`sidebar-nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => { onTabChange(item.key); closeSidebar() }}
            >
              <span className="nav-icon">{iconMap[item.icon]}</span>
              <span>{item.label}</span>
              {activeTab === item.key && (
                <motion.div
                  layoutId="activeNavIndicator"
                  style={{ marginLeft: 'auto' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <ChevronRight size={14} className="text-indigo-500" style={{ color: '#6366f1', opacity: 0.6 }} />
                </motion.div>
              )}
            </motion.button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* AI Badge */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            style={{
              margin: '0 8px 12px',
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
              border: '1px solid rgba(99,102,241,0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={14} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#4f46e5' }}>AI-Powered</span>
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
              Smart quizzes & analytics enabled
            </p>
          </motion.div>

          <div className="sidebar-user" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px' }}>
            <motion.div 
              whileHover={{ scale: 1.1 }}
              className="sidebar-user-avatar"
            >
              {initials(user.name)}
            </motion.div>
            <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name" style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{user.name}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: '2px' }}>
                <span className={`badge ${colors.badge}`} style={{ fontSize: '9px', fontWeight: '700', padding: '2px 6px', textTransform: 'uppercase' }}>
                  {user.role}
                </span>
              </div>
            </div>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: -15 }}
              whileTap={{ scale: 0.9 }}
              className="sidebar-logout-btn" 
              onClick={onLogout} 
              title="Sign Out"
            >
              <LogOut size={15} />
            </motion.button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="top-header-left">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </motion.button>
            <h2 className="top-header-title">
              {items.find(i => i.key === activeTab)?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="top-header-right">
            {headerSlot}
            {!headerSlot && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="header-btn" 
                style={{ position: 'relative' }}
                title="Notifications"
              >
                <Bell size={18} />
                <span style={{ position: 'absolute', top: '-1px', right: '-1px', width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%', border: '2px solid #fff' }} />
              </motion.button>
            )}
            {isParticipant ? (
              <ProfileDropdown
                user={user}
                onTabChange={onTabChange}
                onLogout={onLogout}
              />
            ) : (
              <motion.button
                whileHover={{ scale: 1.05, rotate: -10 }}
                whileTap={{ scale: 0.95 }}
                className="header-btn"
                onClick={onLogout}
                title="Sign Out"
              >
                <LogOut size={18} />
              </motion.button>
            )}
          </div>
        </header>

        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout