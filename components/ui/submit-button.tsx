'use client'

import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border bg-background hover:bg-accent',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
} as const

/// Botón de envío que se deshabilita y muestra un giro mientras la server action
/// está en vuelo. useFormStatus lee el estado del <form> padre, así que este
/// componente tiene que ir dentro del formulario, nunca fuera.
export function SubmitButton({
  children,
  className,
  variant = 'primary',
  pendingLabel,
  ...props
}: ComponentProps<'button'> & {
  variant?: keyof typeof variants
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors outline-none ring-ring focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}
