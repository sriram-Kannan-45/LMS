const colorMap = {
  primary: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950/30 dark:text-primary-300 dark:border-primary-800/50',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50',
  danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/50',
  info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/50',
}

export default function Badge({ children, color = 'primary', className = '', ...props }) {
  const cls = [
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide border transition-colors duration-150',
    colorMap[color] || colorMap.primary,
    className
  ].filter(Boolean).join(' ')

  return (
    <span className={cls} {...props}>
      {children}
    </span>
  )
}
