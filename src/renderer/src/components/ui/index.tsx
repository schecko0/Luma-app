import React from 'react'
import clsx from 'clsx'

// ── Badge de estado ────────────────────────────────────────────────────────────
interface BadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'muted'
  children: React.ReactNode
  className?: string
}
export const Badge: React.FC<BadgeProps> = ({ variant = 'muted', children, className }) => {
  const styles: Record<string, { bg: string; color: string }> = {
    success: { bg: 'color-mix(in srgb, var(--color-success) 15%, transparent)', color: 'var(--color-success)' },
    danger:  { bg: 'color-mix(in srgb, var(--color-danger)  15%, transparent)', color: 'var(--color-danger)'  },
    warning: { bg: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)' },
    info:    { bg: 'color-mix(in srgb, var(--color-info)    15%, transparent)', color: 'var(--color-info)'    },
    muted:   { bg: 'var(--color-surface-2)',                                     color: 'var(--color-text-muted)' },
  }
  const s = styles[variant]
  return (
    <span
      className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', className)}
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  )
}

// ── Spinner de carga ───────────────────────────────────────────────────────────
export const Spinner: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className="animate-spin"
    style={{ color: 'var(--color-accent)' }}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

// ── Estado vacío ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}
    >
      {icon}
    </div>
    <div>
      <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{title}</p>
      {description && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{description}</p>}
    </div>
    {action}
  </div>
)

// ── Confirmación de peligro ────────────────────────────────────────────────────
interface ConfirmBoxProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  loading?: boolean
}
export const ConfirmBox: React.FC<ConfirmBoxProps> = ({
  message, onConfirm, onCancel, confirmLabel = 'Confirmar', loading,
}) => (
  <div
    className="rounded-xl p-4 border flex flex-col gap-3"
    style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
  >
    <p className="text-sm" style={{ color: 'var(--color-text)' }}>{message}</p>
    <div className="flex gap-2 justify-end">
      <button onClick={onCancel} className="luma-btn-ghost text-xs px-3 py-1.5">Cancelar</button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="luma-btn text-xs px-3 py-1.5 text-white"
        style={{ background: 'var(--color-danger)', opacity: loading ? 0.6 : 1 }}
      >
        {confirmLabel}
      </button>
    </div>
  </div>
)

// ── Input de búsqueda ──────────────────────────────────────────────────────────
interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
}
export const SearchInput: React.FC<SearchInputProps> = ({ icon, className, ...props }) => (
  <div className="relative">
    {icon && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }}>
        {icon}
      </span>
    )}
    <input
      {...props}
      className={clsx('luma-input', icon && 'pl-9', className)}
    />
  </div>
)

// ── Paginador ──────────────────────────────────────────────────────────────────
interface PaginatorProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}
export const Paginator: React.FC<PaginatorProps> = ({ page, pageSize, total, onChange }) => {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center gap-1 justify-end pt-3">
      <button
        onClick={() => onChange(page - 1)} disabled={page <= 1}
        className="luma-btn-ghost px-2 py-1 text-xs disabled:opacity-30"
      >
        ‹ Anterior
      </button>
      <span className="text-xs px-3" style={{ color: 'var(--color-text-muted)' }}>
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)} disabled={page >= totalPages}
        className="luma-btn-ghost px-2 py-1 text-xs disabled:opacity-30"
      >
        Siguiente ›
      </button>
    </div>
  )
}

// ── Encabezado de página ──────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, actions }) => (
  <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
       style={{ borderColor: 'var(--color-border)' }}>
    <div className="flex items-center gap-3">
      {icon && (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
             style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
          {icon}
        </div>
      )}
      <div>
        <h1 className="font-display font-semibold text-xl" style={{ color: 'var(--color-text)' }}>
          {title}
        </h1>
        {subtitle && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
)
