'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import type { Role } from '@prisma/client'

import { inviteMemberAction } from '@/app/actions/members'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '@/lib/permissions'
import { EMPTY_STATE } from '@/lib/validation'
import { Dialog } from '@/components/ui/dialog'
import { Field, FormMessage, Input, Select } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export function InviteMemberDialog({ viewerRole }: { viewerRole: Role }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(inviteMemberAction, EMPTY_STATE)
  const [role, setRole] = useState<Role>('DEVELOPER')

  // Solo un administrador puede nombrar a otro. El servidor lo vuelve a
  // comprobar; esconder la opción aquí es cortesía, no seguridad.
  const availableRoles = ROLE_ORDER.filter((value) => value !== 'ADMIN' || viewerRole === 'ADMIN')

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
        onClose={() => {
          setOpen(false)
          if (state.ok) router.refresh()
        }}
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

          <Field label="Rol" htmlFor="invite-role" hint={ROLE_DESCRIPTIONS[role]}>
            <Select
              id="invite-role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {availableRoles.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          {state.message && <FormMessage ok={state.ok}>{state.message}</FormMessage>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                if (state.ok) router.refresh()
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              {state.ok ? 'Cerrar' : 'Cancelar'}
            </button>
            <SubmitButton pendingLabel="Añadiendo…">Añadir</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
