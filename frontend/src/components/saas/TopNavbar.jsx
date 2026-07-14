import { motion } from 'framer-motion'
import { Search, Moon, Bell, Plus } from 'lucide-react'
import { colors } from '../../theme/tokens'

const initials = (name) =>
  name ? name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'

export default function TopNavbar({ user, currentPageLabel, onOpenCreate, onProfile }) {
  if (user.role === 'TRAINER') {
    return (
      <header className="top-header" style={{ padding: '0 24px', borderBottom: '1px solid #e5e7eb', background: '#fff', height: 64 }}>
        <div className="top-header__left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280', fontFamily: "'Inter', sans-serif" }}>
            <span>Home</span>
            <span style={{ color: '#9ca3af' }}>&gt;</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{currentPageLabel}</span>
          </div>
        </div>
        <div className="top-header__right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button aria-label="Search" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}>
            <Search size={18} />
          </button>
          <button aria-label="Toggle dark mode" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}>
            <Moon size={18} />
          </button>
          <button aria-label="Notifications" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, position: 'relative', color: '#6b7280' }}>
            <Bell size={18} />
            <span style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>6</span>
          </button>
          <button
            onClick={onOpenCreate}
            aria-label="Create course"
            style={{
              width: 32, height: 32, borderRadius: 8, background: '#2563eb', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            <Plus size={16} />
          </button>
          <button onClick={onProfile} aria-label="Profile" style={{ position: 'relative', display: 'inline-flex' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${colors.brand.indigo}, ${colors.brand.violet})`, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
              border: '2px solid #fff', boxShadow: '0 2px 8px rgba(79,70,229,0.2)',
            }}>
              {initials(user.name)}
            </div>
            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: colors.success[500], border: '2px solid #fff' }} />
          </button>
        </div>
      </header>
    )
  }

  return (
    <header className="top-header">
      <div className="top-header__left">
        <div className="top-header__breadcrumb">
          <span className="top-header__breadcrumb-page">{currentPageLabel}</span>
          <span className="top-header__breadcrumb-desc">{''}</span>
        </div>
      </div>
      <div className="top-header__right">
        <div className="top-header__search">
          <Search size={16} className="top-header__search-icon" />
          <input type="text" placeholder="Search..." className="top-header__search-input" />
        </div>
        <button className="top-header__icon-btn" title="Notifications" aria-label="Notifications">
          <Bell size={18} />
          <span className="top-header__notify-dot" />
        </button>
        <div className="top-header__divider" />
        <div className="top-header__user" onClick={onProfile} role="button" aria-label="Profile" tabIndex={0}>
          <div className="top-header__avatar">{initials(user.name)}</div>
          <div className="top-header__user-info">
            <span className="top-header__user-name">{user.name}</span>
            <span className="top-header__user-role">{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
