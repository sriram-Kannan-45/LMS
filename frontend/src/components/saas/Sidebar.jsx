import { AnimatePresence, motion } from 'framer-motion'
import {
  Award, BookOpen, BookPlus, ClipboardList, Code, FileText, GraduationCap, Home,
  LayoutDashboard, LogOut, Menu, MessageSquare, Search, Bell, Settings, Shield,
  Sparkles, Trophy, User, UserPlus, Users, X, ChevronRight, ChevronLeft, Moon, Plus, Video,
} from 'lucide-react'
import { colors } from '../../theme/tokens'
import ProfileDropdown from './ProfileDropdown'

export const iconMap = {
  Dashboard: <LayoutDashboard size={22} />,
  Trainings: <BookOpen size={22} />,
  Courses: <GraduationCap size={22} />,
  Trainers: <Users size={22} />,
  Participants: <Users size={22} />,
  Feedback: <MessageSquare size={22} />,
  Surveys: <ClipboardList size={22} />,
  'Add Trainer': <UserPlus size={22} />,
  'My Trainings': <BookOpen size={22} />,
  'My Courses': <GraduationCap size={22} />,
  'My Profile': <User size={22} />,
  Available: <BookOpen size={22} />,
  Enrollments: <BookPlus size={22} />,
  'Give Feedback': <MessageSquare size={22} />,
  'My Feedbacks': <MessageSquare size={22} />,
  'AI Quizzes': <Sparkles size={22} />,
  Overview: <Home size={22} />,
  Leaderboard: <Trophy size={22} />,
  Achievements: <Award size={22} />,
  Lessons: <FileText size={22} />,
  Coding: <Code size={22} />,
  Profile: <User size={22} />,
  ClipboardList: <ClipboardList size={22} />,
  FileText: <FileText size={22} />,
  Notes: <FileText size={22} />,
  'UserPlus': <UserPlus size={22} />,
  'Enrollment Requests': <UserPlus size={22} />,
  'Trainer Reports': <ClipboardList size={22} />,
  'My Interviews': <Video size={22} />,
  'My Learning': <BookOpen size={22} />,
  'Calendar': <Calendar size={22} />,
  'Certificates': <Award size={22} />,
  'Settings': <Settings size={22} />,
}

export const navGroups = {
  ADMIN: [
    { title: 'Overview', items: [{ key: 'overview', label: 'Dashboard', icon: 'Dashboard' }] },
    {
      title: 'Management',
      items: [
        { key: 'pending', label: 'Pending Approval', icon: 'Overview' },
        { key: 'trainings', label: 'Trainings', icon: 'Trainings' },
        { key: 'trainers', label: 'Trainers', icon: 'Trainers' },
        { key: 'participants', label: 'Participants', icon: 'Participants' },
      ],
    },
    {
      title: 'Content',
      items: [
        { key: 'sessions', label: 'Sessions', icon: 'AI Quizzes' },
        { key: 'notes', label: 'Notes', icon: 'Lessons' },
        { key: 'feedback', label: 'Feedback', icon: 'Feedback' },
        { key: 'surveys', label: 'Surveys', icon: 'Surveys' },
      ],
    },
  ],
  TRAINER: [
    {
      title: 'DASHBOARD',
      items: [
        { key: 'overview', label: 'Trainings', icon: 'Trainings' },
        { key: 'courses', label: 'My Learning', icon: 'My Learning' },
        { key: 'calendar', label: 'Calendar', icon: 'Calendar' },
        { key: 'certificates', label: 'Certificates', icon: 'Certificates' }
      ]
    },
    {
      title: 'MANAGEMENT',
      items: [
        { key: 'assignments', label: 'Enrollment Requests', icon: 'Enrollment Requests', badge: 5 },
        { key: 'reports', label: 'Trainer Reports', icon: 'Trainer Reports' }
      ]
    },
    {
      title: 'CONTENT',
      items: [
        { key: 'notes', label: 'Notes & Resources', icon: 'Notes' },
        { key: 'interviews', label: 'My Interviews', icon: 'My Interviews' },
        { key: 'feedback', label: 'Feedback Received', icon: 'Feedback' }
      ]
    },
    {
      title: 'USER',
      items: [
        { key: 'profile', label: 'My Profile', icon: 'My Profile' },
        { key: 'settings', label: 'Settings', icon: 'Settings' }
      ]
    }
  ],
  PARTICIPANT: [
    { title: 'Overview', items: [{ key: 'overview', label: 'Overview', icon: 'Overview' }] },
    { title: 'Learning', items: [{ key: 'myEnrollments', label: 'My Trainings', icon: 'Trainings' }, { key: 'leaderboard', label: 'Leaderboard', icon: 'Leaderboard' }, { key: 'achievements', label: 'Achievements', icon: 'Achievements' }] },
    { title: 'Activity', items: [{ key: 'reports', label: 'My Reports', icon: 'Feedback' }, { key: 'certificates', label: 'Certificates', icon: 'Achievements' }, { key: 'feedback', label: 'Give Feedback', icon: 'Give Feedback' }, { key: 'myFeedbacks', label: 'My Feedbacks', icon: 'My Feedbacks' }] },
    { title: 'Settings', items: [{ key: 'profile', label: 'Profile', icon: 'Profile' }] },
  ],
}

const pageDescriptions = {
  overview: 'Monitor your platform activity and key metrics',
  pending: 'Review and approve pending registrations',
  trainings: 'Manage all training programs',
  trainers: 'Manage trainer accounts and assignments',
  participants: 'View and manage learner accounts',
  sessions: 'Manage assessment and quiz sessions',
  notes: 'Organize course notes and resources',
  feedback: 'View and respond to feedback',
  surveys: 'Create and manage surveys',
  courses: 'Manage your training courses',
  reports: 'View detailed analytics and reports',
  profile: 'Manage your account settings',
  myEnrollments: 'Your enrolled training programs',
  leaderboard: 'See how you rank among learners',
  achievements: 'Your badges and accomplishments',
  certificates: 'Download your completion certificates',
  myFeedbacks: 'Feedback you\'ve submitted',
}

export { pageDescriptions }

const initials = (name) =>
  name ? name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'

export default function Sidebar({ user, activeTab, onTabChange, onLogout, onCloseSidebar, sidebarOpen, onOpenSidebar }) {
  const groups = navGroups[user.role] || []
  const isParticipant = user.role === 'PARTICIPANT'

  const currentPageLabel = (() => {
    for (const group of groups) {
      const found = group.items.find(i => i.key === activeTab)
      if (found) return found.label
    }
    return 'Dashboard'
  })()

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sidebar-overlay open"
            onClick={onCloseSidebar}
            style={{ display: 'block' }}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ background: `linear-gradient(180deg, ${colors.sidebar.bg} 0%, ${colors.sidebar.bgMid} 50%, ${colors.sidebar.bgEnd} 100%)` }}>
        <div className="sidebar-header">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="sidebar-logo"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: user.role === 'TRAINER' ? '#10B981' : `linear-gradient(135deg, ${colors.brand.indigo}, ${colors.brand.violet})`,
              boxShadow: user.role === 'TRAINER' ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}
          >
            W
          </motion.div>
          <div className="sidebar-brand">
            <span className="sidebar-brand-name">WAVE INIT</span>
            <span className="sidebar-brand-tagline">Learning Management</span>
          </div>
          <button className="sidebar-close-btn" onClick={onCloseSidebar} style={{ position: 'relative', zIndex: 1 }}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group, gi) => (
            <div key={gi}>
              <div className="sidebar-nav-label">{group.title}</div>
              {group.items.map((item) => {
                const isActive = activeTab === item.key
                const isTrainer = user.role === 'TRAINER'
                return (
                  <motion.button
                    key={item.key}
                    className={`sidebar-nav-item${isActive ? ' active' : ''}`}
                    onClick={() => {
                      if (item.key === 'profile' && isTrainer) {
                        onTabChange('profile')
                      } else {
                        onTabChange(item.key)
                      }
                      onCloseSidebar && onCloseSidebar()
                    }}
                    whileTap={{ scale: 0.98 }}
                    style={
                      isActive
                        ? isTrainer
                          ? {
                              background: 'rgba(16, 185, 129, 0.08)',
                              borderRadius: '12px',
                              color: '#10B981',
                              position: 'relative',
                              paddingLeft: '24px'
                            }
                          : {
                              background: `linear-gradient(135deg, ${colors.brand.blueDark} 0%, ${colors.brand.blue} 100%)`,
                              borderRadius: '14px',
                              color: '#fff',
                              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                            }
                        : undefined
                    }
                  >
                    {isActive && isTrainer && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '20%',
                          bottom: '20%',
                          width: '4px',
                          borderRadius: '0 4px 4px 0',
                          backgroundColor: '#10B981'
                        }}
                      />
                    )}
                    <span className="nav-icon" style={isActive ? { color: isTrainer ? '#10B981' : '#fff' } : undefined}>
                      {iconMap[item.icon]}
                    </span>
                    <span style={{ fontWeight: isActive ? 700 : 500, flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.badge !== undefined && (
                      <span style={{
                        marginLeft: 'auto',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#2563EB',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          ))}
        </nav>

        {user.role === 'TRAINER' && (
          <div style={{
            padding: '16px',
            margin: '12px 16px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
            boxShadow: '0 8px 24px rgba(30,58,138,0.2)',
            color: '#fff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Award size={14} style={{ color: '#FCD34D' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Keep learning!</span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: '0 0 12px', lineHeight: 1.4 }}>
              Complete more courses and earn new badges.
            </p>
            <button
              onClick={() => onTabChange('courses')}
              style={{
                width: '100%',
                padding: '6px 12px',
                background: '#2563EB',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.2s',
                outline: 'none'
              }}
              className="hover:bg-blue-700"
            >
              View My Progress →
            </button>
          </div>
        )}

        {user.role === 'TRAINER' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <button
              onClick={onCloseSidebar}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              className="hover:bg-slate-800 hover:text-white"
              title="Collapse"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          {isParticipant ? (
            <ProfileDropdown user={user} onTabChange={onTabChange} onLogout={onLogout} />
          ) : (
            <ProfileDropdown
              user={user}
              onProfile={() => onTabChange('profile')}
              onLogout={onLogout}
            />
          )}
        </div>
      </aside>

      {!sidebarOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="mobile-sidebar-toggle"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </motion.button>
      )}
    </>
  )
}
