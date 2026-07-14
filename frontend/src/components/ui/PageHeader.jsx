import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PageHeader({
  title,
  subtitle,
  action,
  backLink,
  onBack,
  breadcrumbs = [],
  className = '',
}) {
  return (
    <div className={`flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-5 border-b border-slate-100 dark:border-slate-800/80 ${className}`}>
      <div className="space-y-2 min-w-0">
        {/* Breadcrumbs or Back button */}
        {backLink ? (
          <Link
            to={backLink}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </Link>
        ) : onBack ? (
          <button
            onClick={onBack}
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
        ) : breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            {breadcrumbs.map((bc, idx) => (
              <span key={idx} className="flex items-center gap-1.5">
                {bc.link ? (
                  <Link to={bc.link} className="hover:text-slate-600 transition-colors">
                    {bc.label}
                  </Link>
                ) : (
                  <span>{bc.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span>/</span>}
              </span>
            ))}
          </div>
        ) : null}

        {/* Title and Subtitle */}
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons slot */}
      {action && (
        <div className="flex items-center gap-2 flex-shrink-0 md:self-end">
          {action}
        </div>
      )}
    </div>
  )
}
