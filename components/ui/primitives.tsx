import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { avatarColor, initials } from '@/lib/format'

// Piezas pequeñas que se repiten en todas las pantallas. Vivir aquí evita que
// una tarjeta o una etiqueta se dibujen distinto en cada página.

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border border-border bg-card', className)} {...props} />
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        className,
      )}
      {...props}
    />
  )
}

export function Avatar({
  name,
  seed,
  size = 'md',
  className,
}: {
  name: string
  seed: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'size-6 text-[9px]',
    md: 'size-8 text-[11px]',
    lg: 'size-10 text-xs',
  }
  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        avatarColor(seed),
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

/// Marcador para cuando una lista está vacía. Siempre dice qué hacer a
/// continuación, no solo que no hay nada.
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string[]
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </label>
      {children}
      {hint && !error?.length && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error?.length ? (
        <p className="text-[11px] font-medium text-destructive" role="alert">
          {error[0]}
        </p>
      ) : null}
    </div>
  )
}

const inputBase =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow placeholder:text-muted-foreground focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputBase, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputBase, 'min-h-24 resize-y', className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(inputBase, 'cursor-pointer', className)} {...props} />
}

/// Franja de aviso al pie de un formulario.
export function FormMessage({ ok, children }: { ok?: boolean; children: ReactNode }) {
  if (!children) return null
  return (
    <p
      role="status"
      className={cn(
        'rounded-lg px-3 py-2 text-xs leading-5',
        ok
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {children}
    </p>
  )
}

/// Barra de progreso. `value` va de 0 a 100.
export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
