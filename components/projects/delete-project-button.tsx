'use client'

import { useActionState, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { deleteProjectAction } from '@/app/actions/projects'
import { EMPTY_STATE } from '@/lib/validation'
import { Dialog } from '@/components/ui/dialog'
import { FormMessage, Input } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

/// Borrar un proyecto arrastra sus tareas y comentarios. Se pide escribir la
/// clave para que no ocurra por un clic distraído.
export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [state, formAction] = useActionState(deleteProjectAction, EMPTY_STATE)

  const matches = confirmation.trim() === projectName

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
        Eliminar
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Eliminar proyecto"
        description="Se borrarán también todas sus tareas y comentarios. No se puede deshacer."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={projectId} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-name" className="text-xs font-semibold">
              Escribe <span className="font-mono text-destructive">{projectName}</span> para confirmar
            </label>
            <Input
              id="confirm-name"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              placeholder={projectName}
            />
          </div>

          {state.message && <FormMessage>{state.message}</FormMessage>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <SubmitButton variant="destructive" disabled={!matches} pendingLabel="Eliminando…">
              Eliminar definitivamente
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
