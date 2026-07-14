export default function Card({ children, className = '', padding = true, hover = false, ...props }) {
  const cls = [
    'glass-surface',
    padding && 'glass-surface--padded',
    hover && 'glass-surface--hover',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '', action }) {
  return (
    <div className={`card-header ${className}`}>
      <div className="card-header-content">{children}</div>
      {action && <div className="card-header-action">{action}</div>}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`card-body ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }) {
  return <div className={`card-footer ${className}`}>{children}</div>
}
