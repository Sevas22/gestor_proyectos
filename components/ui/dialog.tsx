'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

// Cuántos diálogos hay abiertos a la vez. Al pasar del detalle de una tarea a su
// formulario de edición hay un instante con dos montados; sin este contador, el
// que se cierra primero restauraría el desplazamiento del body mientras el otro
// sigue abierto, o al revés: lo dejaría bloqueado para siempre.
let openDialogCount = 0

function lockScroll() {
  if (openDialogCount === 0) document.body.style.overflow = 'hidden'
  openDialogCount += 1
}

function unlockScroll() {
  openDialogCount = Math.max(0, openDialogCount - 1)
  if (openDialogCount === 0) document.body.style.overflow = ''
}

/// Diálogo modal. Se monta en un portal sobre <body> para que ningún
/// `overflow: hidden` de una tarjeta lo recorte.
///
/// Accesibilidad: cierra con Escape, bloquea el desplazamiento del fondo y
/// devuelve el foco al elemento que lo abrió al cerrarse.
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  // El portal solo puede existir en el navegador, pero devolver `null` en el
  // servidor y el portal en el primer render del cliente son dos árboles
  // distintos en la misma posición: eso es exactamente lo que React cuenta
  // como fallo de hidratación. Con este estado el primer render del cliente
  // también devuelve `null`, igual que el del servidor, y el portal aparece
  // en el render siguiente, ya con la hidratación terminada.
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  useEffect(() => {
    // Espera a `montado`: hasta entonces el portal no existe y `panelRef`
    // está vacío, así que no habría campo al que llevar el foco.
    if (!open || !montado) return

    openerRef.current = document.activeElement
    lockScroll()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    // Enfoca el primer campo para poder escribir sin tocar el ratón.
    const firstField = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]), textarea, select',
    )
    firstField?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unlockScroll()
      ;(openerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [open, montado, onClose])

  if (!open || !montado) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="fixed inset-0 bg-foreground/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative my-auto w-full rounded-xl border border-border bg-card shadow-xl',
          size === 'lg' ? 'max-w-2xl' : 'max-w-md',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
