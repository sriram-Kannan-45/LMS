import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-md hover:from-primary-700 hover:to-primary-800 border border-primary-500/20 focus-ring',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm focus-ring dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/50',
  outline: 'bg-transparent text-slate-700 border border-slate-200 hover:bg-slate-50 focus-ring dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-rose-500/20 focus-ring',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm font-semibold rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-base font-semibold rounded-xl gap-2.5',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const cls = [
    'inline-flex items-center justify-center font-medium cursor-pointer transition-all duration-200 select-none active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed',
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    className,
  ].filter(Boolean).join(' ')

  return (
    <motion.button
      type={type}
      whileHover={!disabled && !loading ? { y: -1 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
      className={cls}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="animate-spin mr-1" />}
      {!loading && Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
      {children && <span>{children}</span>}
      {!loading && Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
    </motion.button>
  )
}
