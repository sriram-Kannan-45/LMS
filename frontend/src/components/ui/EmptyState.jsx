import { Inbox } from 'lucide-react'
import Button from './Button'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm ${className}`}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-400 border border-primary-100 dark:border-primary-900/30">
        <Icon size={24} />
      </div>
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
