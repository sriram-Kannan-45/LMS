import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
}) {
  const widthMap = { sm: 400, md: 500, lg: 640, xl: 800 }
  const maxW = widthMap[size] || 500

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={onClose}
        >
          <motion.div
            className={`glass-surface ${className}`}
            style={{
              width: '100%',
              maxWidth: maxW,
              maxHeight: '85vh',
              overflow: 'auto',
              padding: 0,
            }}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={e => e.stopPropagation()}
          >
            {title && (
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid var(--border-default)' }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
                <button
                  onClick={onClose}
                  className="btn-icon"
                  style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="px-6 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
