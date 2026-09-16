'use client'

import { useActionState, useCallback, useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'

import { resetMemberPasswordAction } from '@/app/actions/members'
import { EMPTY_STATE } from '@/lib/validation'
import { Dialog } from '@/components/ui/dialog'
import { FormMessage } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

/// Botón de la fila de un miembro que abre el restablecimiento de contraseña.
export function ResetPasswordButton({ membershipId, name }: { membershipId: string; name: string }) {
  const [open, setOpen] = useState(false)
  // Estable a propósito: el diálogo vuelve a montar sus efectos si cambia
  // `onClose`, y eso le robaría el foco al resultado en cada render.
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Restablecer la contraseña de ${name}`}
        title="Restablecer contraseña"
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <KeyRound className="size-4" />
      </button>

      <Dialog open={open} onClose={close} title={`Restablecer la contraseña de ${name}`}>
        {/* El panel vive dentro del diálogo, que se desmonta al cerrarse: así
            la contraseña generada desaparece de la memoria del navegador con
            él, y al volver a abrirlo se empieza de cero en vez de enseñar la
            anterior. */}
        <ResetPasswordPanel membershipId={membershipId} name={name} onClose={close} />
      </Dialog>
    </>
  )
}

function ResetPasswordPanel({
  membershipId,
  name,
  onClose,
}: {
  membershipId: string
  name: string
  onClose: () => void
}) {
  const [state, action] = useActionState(resetMemberPasswordAction, EMPTY_STATE)

  if (state.ok && state.temporaryPassword) {
    return <TemporaryPassword name={name} password={state.temporaryPassword} onClose={onClose} />
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="membershipId" value={membershipId} />

      <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-6 text-muted-foreground">
        <li>Se genera una contraseña temporal y la actual deja de funcionar.</li>
        <li>Si {name} tenía la sesión abierta en algún sitio, se cerrará.</li>
        <li>
          La temporal se enseña <span className="font-semibold text-foreground">una sola vez</span>,
          aquí. Tendrás que hacérsela llegar tú.
        </li>
      </ul>

      {state.message && !state.ok && <FormMessage>{state.message}</FormMessage>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          Cancelar
        </button>
        <SubmitButton pendingLabel="Restableciendo…">Restablecer contraseña</SubmitButton>
      </div>
    </form>
  )
}

function TemporaryPassword({
  name,
  password,
  onClose,
}: {
  name: string
  password: string
  onClose: () => void
}) {
  const [copiada, setCopiada] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password)
      setCopiada(true)
    } catch {
      // Sin acceso al portapapeles (permiso denegado, contexto no seguro) la
      // contraseña sigue en pantalla y se selecciona entera con un clic.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormMessage ok>Contraseña de {name} restablecida.</FormMessage>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/40 p-3">
        <code
          aria-label="Contraseña temporal"
          className="min-w-0 flex-1 truncate font-mono text-lg font-semibold tracking-wider select-all"
        >
          {password}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
        >
          {copiada ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copiada ? 'Copiada' : 'Copiar'}
        </button>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Anótala ahora: al cerrar esta ventana ya no se puede volver a ver. Pídele a {name} que
        entre con ella y la cambie en <span className="font-semibold text-foreground">Ajustes</span>,
        porque mientras no lo haga tú también la conoces.
      </p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Hecho
        </button>
      </div>
    </div>
  )
}
