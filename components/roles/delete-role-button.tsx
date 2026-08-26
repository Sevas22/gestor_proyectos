'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

import { deleteRoleAction } from '@/app/actions/roles'
import { EMPTY_STATE } from '@/lib/validation'
import { plural } from '@/lib/format'
import { Dialog } from '@/components/ui/dialog'
import { FormMessage } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export function DeleteRoleButton({
  roleId,
  roleName,
  memberCount,
}: {
  roleId: string
  roleName: string
  memberCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(deleteRoleAction, EMPTY_STATE)

  useEffect(() => {
    if (!state.ok) return
    setOpen(false)
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Un rol con gente no se puede borrar: la relación es onDelete: Restrict.
  // Se avisa aquí para que no haya que intentarlo para descubrirlo.
  const enUso = memberCount > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Eliminar el rol ${roleName}`}
        title={enUso ? `${plural(memberCount, 'persona')} tiene este rol` : 'Eliminar rol'}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Eliminar «${roleName}»`}
        description={
          enUso
            ? 'Este rol está en uso, así que todavía no se puede eliminar.'
            : 'El rol desaparece del equipo. No afecta a ninguna persona porque nadie lo tiene.'
        }
      >
        {enUso ? (
          <div className="flex flex-col gap-4">
            <FormMessage>
              {plural(memberCount, 'persona tiene', 'personas tienen')} este rol. Cámbiales el rol
              desde la pantalla de Equipo y vuelve a intentarlo.
            </FormMessage>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={roleId} />
            {state.message && <FormMessage>{state.message}</FormMessage>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                Cancelar
              </button>
              <SubmitButton variant="destructive" pendingLabel="Eliminando…">
                Eliminar rol
              </SubmitButton>
            </div>
          </form>
        )}
      </Dialog>
    </>
  )
}
