import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar, { navGroups, pageDescriptions } from './saas/Sidebar'
import TopNavbar from './saas/TopNavbar'

function Layout({ user, children, activeTab, onTabChange, onLogout, headerSlot }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const groups = navGroups[user.role] || []
  const isParticipant = user.role === 'PARTICIPANT'

  const closeSidebar = () => setSidebarOpen(false)
  const openSidebar = () => setSidebarOpen(true)

  const currentPageLabel = (() => {
    for (const group of groups) {
      const found = group.items.find(i => i.key === activeTab)
      if (found) return found.label
    }
    return 'Dashboard'
  })()

  const currentPageDescription = pageDescriptions[activeTab] || ''

  const handleOpenCreate = () => {
    const event = new CustomEvent('open-create-course')
    window.dispatchEvent(event)
  }

  const handleProfile = () => {
    if (user?.role === 'TRAINER') navigate('/trainer/profile')
    else onTabChange('profile')
  }

  return (
    <div className={`app-layout ${user.role === 'TRAINER' ? 'theme-trainer' : 'theme-academic'}`}>
      <Sidebar
        user={user}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onLogout={onLogout}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={closeSidebar}
        onOpenSidebar={openSidebar}
      />

      <div className="main-content">
        {user.role !== 'TRAINER' && (
          <TopNavbar
            user={user}
            currentPageLabel={currentPageLabel}
            onOpenCreate={handleOpenCreate}
            onProfile={handleProfile}
          />
        )}

        <motion.main
          className="page-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}

export default Layout
