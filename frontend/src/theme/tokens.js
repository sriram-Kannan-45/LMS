// ═══════════════════════════════════════════════════════════════════
// DESIGN TOKENS — Single source of truth for the entire LMS UI
// ═══════════════════════════════════════════════════════════════════
//
// DESIGN RATIONALE:
// This training/LMS platform is used by trainers for hours daily. The
// palette centers on deep ocean teal (#0D9488) — conveying trust,
// growth, and calm focus ideal for educational tools. Warm stone
// backgrounds (#FAFAF9 / #FFFFFF) reduce eye strain during long
// sessions. Amber (#D97706) is reserved exclusively for ratings and
// achievement highlights, creating a rewarding warm contrast. The
// signature visual element is a subtle bottom-edge gradient bar on
// interactive stat cards that shifts from teal to cyan on hover,
// reinforcing the "learning growth" metaphor throughout the app.
//
// ═══════════════════════════════════════════════════════════════════

// ── Color Palette ─────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bg: {
    base: '#f8fafc',
    raised: '#ffffff',
    overlay: 'rgba(15, 23, 42, 0.5)',
    overlayLight: 'rgba(15, 23, 42, 0.25)',
  },

  // Surfaces
  surface: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
    hover: '#f1f5f9',
  },

  // Borders
  border: {
    default: '#e5e7eb',
    light: '#f1f5f9',
    focus: '#0d9488',
    dashed: '#cbd5e1',
  },

  // Text
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#6b7280',
    inverse: '#ffffff',
    link: '#0d9488',
    linkHover: '#0f766e',
  },

  // Primary — Teal (trust, growth, calm focus)
  primary: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },

  // Secondary — Blue
  secondary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Accent Warm — Amber (ratings, achievements)
  accent: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Success — Green
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  // Warning — Amber
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Danger — Red
  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  // Info — Blue
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Neutral Slate
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  // Sidebar
  sidebar: {
    bg: '#0F172A',
    bgMid: '#16213E',
    bgEnd: '#1E293B',
    activeBg: '#2563EB',
    activeText: '#ffffff',
    hoverBg: 'rgba(255, 255, 255, 0.06)',
  },

  // Brand — Indigo/Violet (hero, logo, accent elements — ONLY here)
  brand: {
    indigo: '#4F46E5',
    indigoDark: '#4338CA',
    violet: '#7C3AED',
    violetLight: '#8B5CF6',
    violetTint: '#EDE9FE',
    blue: '#3B82F6',
    blueDark: '#2563EB',
    blueTint: '#DBEAFE',
    green: '#16A34A',
    greenLight: '#10B981',
    greenTint: '#DCFCE7',
    amber: '#F59E0B',
    amberTint: '#FEF3C7',
  },

  // Semantic gradients
  gradient: {
    primary: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
    primaryStrong: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)',
    hero: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)',
    logo: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
    warm: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    success: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
    danger: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
    sidebar: 'linear-gradient(180deg, #0F172A 0%, #16213E 50%, #1E293B 100%)',
    courseNode: 'linear-gradient(135deg, #059669, #0D9488)',
    courseJava: 'linear-gradient(135deg, #EA580C, #F59E0B)',
  },
}

// ── Typography ────────────────────────────────────────────────────

export const typography = {
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontFamilyMono: "'JetBrains Mono', 'Fira Code', monospace",
}

// ── Button Styles ─────────────────────────────────────────────────

const baseBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontFamily: typography.fontFamily,
  fontWeight: 600,
  borderRadius: '12px',
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
  transition: 'all 0.2s ease',
  whiteSpace: 'nowrap',
}

export const btnPrimary = {
  ...baseBtn,
  background: colors.secondary[600],
  color: colors.text.inverse,
  padding: '10px 20px',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
  boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
}

export const btnSecondary = {
  ...baseBtn,
  background: colors.surface.primary,
  color: colors.text.secondary,
  border: `1px solid ${colors.border.default}`,
  padding: '10px 20px',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
}

export const btnDanger = {
  ...baseBtn,
  background: colors.danger[600],
  color: colors.text.inverse,
  padding: '10px 20px',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
}

export const btnSuccess = {
  ...baseBtn,
  background: colors.success[600],
  color: colors.text.inverse,
  padding: '10px 20px',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
}

export const btnWarning = {
  ...baseBtn,
  background: colors.warning[600],
  color: colors.text.inverse,
  padding: '10px 20px',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
}

export const btnOutline = {
  ...baseBtn,
  background: 'transparent',
  color: colors.text.secondary,
  border: `1px solid ${colors.border.default}`,
  padding: '10px 20px',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
}

export function iconBtn(bg = 'transparent', fg = colors.text.secondary, size = 36) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '10px',
    background: bg,
    color: fg,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  }
}

// ── Badge / Status Pill Styles ────────────────────────────────────

function badge(baseBg, baseFg) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: '8px',
    fontSize: '0.75rem',
    lineHeight: '1rem',
    fontWeight: 600,
    background: baseBg,
    color: baseFg,
    whiteSpace: 'nowrap',
  }
}

// Training / assessment statuses
export const STATUS_BADGE = {
  DRAFT:              badge(colors.slate[100], colors.slate[600]),
  PUBLISHED:          badge('#dcfce7', '#16a34a'),
  CLOSED:             badge(colors.danger[100], colors.danger[600]),
  RESULTS_PUBLISHED:  badge(colors.info[100], colors.info[700]),
  ARCHIVED:           badge('#F5F5F4', '#78716C'),
}

// Result visibility statuses
export const RESULT_BADGE = {
  HIDDEN:    badge(colors.warning[100], colors.warning[800]),
  PUBLISHED: badge(colors.success[100], colors.success[700]),
}

// Difficulty levels
export const DIFF_BADGE = {
  EASY:   badge(colors.success[100], colors.success[700]),
  MEDIUM: badge(colors.warning[100], colors.warning[800]),
  HARD:   badge(colors.danger[100], colors.danger[600]),
}

// Quiz / coding attempt statuses
export const ATTEMPT_STATUS = {
  NOT_STARTED:      { bg: colors.slate[100], fg: colors.slate[600], label: 'Not Started' },
  IN_PROGRESS:      { bg: colors.info[100], fg: colors.info[700], label: 'In Progress' },
  SUBMITTED:        { bg: colors.success[100], fg: colors.success[700], label: 'Submitted' },
  COMPLETED:        { bg: colors.success[100], fg: colors.success[700], label: 'Completed' },
  WAITING_RESULT:   { badge: badge(colors.warning[100], colors.warning[800]), label: 'Waiting Result' },
  RESULT_PUBLISHED: { bg: colors.info[100], fg: colors.info[700], label: 'Result Published' },
  DISQUALIFIED:     { bg: colors.danger[100], fg: colors.danger[600], label: 'Disqualified' },
}

// Material type badges
export const TYPE_BADGE = {
  NOTE:         badge(colors.primary[50], colors.primary[700]),
  PDF:          badge(colors.danger[100], colors.danger[600]),
  PPT:          badge(colors.warning[100], colors.warning[800]),
  VIDEO:        badge(colors.info[100], colors.info[700]),
  IMAGE:        badge(colors.success[100], colors.success[700]),
  LINK:         badge('#F3E8FF', '#7E22CE'),
  ATTACHMENT:   badge(colors.slate[100], colors.slate[600]),
  LIVE_SESSION: badge('#FAE8FF', '#C084FC'),
}

// Quiz result status (legacy naming for some files)
export const RESULT_STATUS_BADGE = {
  HIDDEN:    badge(colors.warning[100], colors.warning[800]),
  PUBLISHED: badge(colors.success[100], colors.success[700]),
}

// ── Form / Input Styles ───────────────────────────────────────────

export const lblStyle = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: colors.text.primary,
  marginBottom: '6px',
  fontFamily: typography.fontFamily,
}

export const lblTiny = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: colors.text.muted,
  marginBottom: '4px',
  fontFamily: typography.fontFamily,
}

export const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '12px',
  border: `1px solid ${colors.border.default}`,
  background: colors.surface.primary,
  color: colors.text.primary,
  fontSize: '0.875rem',
  fontFamily: typography.fontFamily,
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  boxSizing: 'border-box',
}

export const selectStyle = {
  ...inputStyle,
  appearance: 'none',
  cursor: 'pointer',
}

export const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '80px',
}

// ── Table Styles ──────────────────────────────────────────────────

export const th = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: colors.text.muted,
  background: colors.surface.secondary,
  borderBottom: `1px solid ${colors.border.default}`,
  fontFamily: typography.fontFamily,
  whiteSpace: 'nowrap',
}

export const td = {
  padding: '12px 16px',
  fontSize: '0.875rem',
  color: colors.text.secondary,
  borderBottom: `1px solid ${colors.border.light}`,
  fontFamily: typography.fontFamily,
  verticalAlign: 'middle',
}

// ── Card / Surface Style ──────────────────────────────────────────

export const cardStyle = {
  background: colors.surface.primary,
  borderRadius: '22px',
  border: `1px solid ${colors.border.default}`,
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 6px 16px rgba(0, 0, 0, 0.04)',
  overflow: 'hidden',
}

export const cardPadding = {
  padding: '24px',
}

// ── Chart / Analytics Colors ──────────────────────────────────────

export const COMPLETION_COLORS = {
  completed:   colors.success[600],
  inProgress:  colors.warning[500],
  notStarted:  colors.slate[400],
}

export const CHART_COLORS = {
  primary:   colors.primary[600],
  secondary: colors.secondary[600],
  success:   colors.success[600],
  warning:   colors.warning[500],
  danger:    colors.danger[600],
  muted:     colors.slate[400],
}

// ── Activity / Timeline ───────────────────────────────────────────

export const activityColors = {
  course: {
    published: { text: colors.success[600], bg: colors.success[50] },
    draft:     { text: colors.warning[600], bg: colors.warning[50] },
    default:   { text: colors.primary[600], bg: colors.primary[50] },
  },
  quiz: {
    default: { text: colors.secondary[600], bg: colors.secondary[50] },
  },
  alert: {
    default: { text: colors.danger[600], bg: colors.danger[50] },
  },
}

// ── Podium / Leaderboard ──────────────────────────────────────────

export const PODIUM_COLORS = [
  colors.accent[500],  // gold
  colors.slate[400],   // silver
  '#CD7C47',           // bronze
]

export const MEDAL_COLORS = {
  1: colors.accent[500],
  2: colors.slate[400],
  3: '#CD7C47',
}

// ── Severity Styles (for violations / proctoring) ─────────────────

export const SEVERITY_STYLES = {
  CRITICAL: { bg: colors.danger[100], fg: colors.danger[600], label: 'Critical' },
  HIGH:     { bg: colors.danger[100], fg: colors.danger[600], label: 'High' },
  MEDIUM:   { bg: colors.warning[100], fg: colors.warning[800], label: 'Medium' },
  LOW:      { bg: colors.accent[100], fg: colors.accent[700], label: 'Low' },
  INFO:     { bg: colors.info[100], fg: colors.info[600], label: 'Info' },
}

// ── Skeleton / Loading ────────────────────────────────────────────

export const skeletonStyle = {
  background: `linear-gradient(90deg, ${colors.slate[100]} 25%, ${colors.slate[200]} 50%, ${colors.slate[100]} 75%)`,
  backgroundSize: '200% 100%',
  animation: 'shimmer 2s infinite',
  borderRadius: '8px',
}

// ── Helper: Generate a badge from a value map ─────────────────────

export function statusBadge(value) {
  const map = STATUS_BADGE[value]
  if (!map) return badge(colors.slate[100], colors.slate[600])
  return map
}

export function resultBadge(value) {
  const map = RESULT_BADGE[value]
  if (!map) return badge(colors.slate[100], colors.slate[600])
  return map
}

export function diffBadge(value) {
  const map = DIFF_BADGE[value]
  if (!map) return badge(colors.slate[100], colors.slate[600])
  return map
}

export function typeBadge(value) {
  const map = TYPE_BADGE[value]
  if (!map) return badge(colors.slate[100], colors.slate[600])
  return map
}

export function attemptStatusBadge(value) {
  const map = ATTEMPT_STATUS[value]
  if (!map) return badge(colors.slate[100], colors.slate[600])
  if (map.badge) return map.badge
  return badge(map.bg, map.fg)
}
