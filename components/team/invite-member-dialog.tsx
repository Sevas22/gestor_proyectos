'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'

import { inviteMemberAction } from '@/app/actions/members'
import { EMPTY_STATE } from '@/lib/validation'
import { Dialog } from '@/components/ui/dialog'
import { Field, FormMessage, Input } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'
import { RoleSelect, type RoleOption } from '@/components/team/role-select'

export function InviteMemberDialog({ roles }: { roles: RoleOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(inviteMemberAction, EMPTY_STATE)
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '')

  const seleccionado = roles.find((role) => role.id === roleId)

  function close() {
    setOpen(false)
    if (state.ok) router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <UserPlus className="size-4" />
        Añadir miembro
      </button>

      <Dialog
        open={open}
        onClose={close}
        title="Añadir al equipo"
        description="Si el correo ya tiene cuenta, se añade directamente. Si no, se crea una con contraseña temporal."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Correo" htmlFor="invite-email" error={state.errors?.email}>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="persona@equipo.com"
            />
          </Field>

          <Field
            label="Rol"
            htmlFor="invite-role"
            hint={seleccionado?.description}
            error={state.errors?.roleId}
          >
            <RoleSelect
              id="invite-role"
              name="roleId"
              roles={roles}
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
            />
          </Field>

          {state.message && <FormMessage ok={state.ok}>{state.message}</FormMessage>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              {state.ok ? 'Cerrar' : 'Cancelar'}
            </button>
            <SubmitButton pendingLabel="Añadiendo…" disabled={roles.length === 0}>
              Añadir
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
