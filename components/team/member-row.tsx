'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

import { removeMemberAction, updateMemberRoleAction } from '@/app/actions/members'
import { plural, roleColor } from '@/lib/format'
import { EMPTY_STATE } from '@/lib/validation'
import { Avatar, Badge, FormMessage, Progress } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'
import { Dialog } from '@/components/ui/dialog'
import { RoleSelect, type RoleOption } from '@/components/team/role-select'

export function MemberRow({
  membership,
  roles,
  workload,
  isSelf,
  canManage,
  maxOpen,
}: {
  membership: {
    id: string
    role: { id: string; name: string; colorSeed: number }
    joinedAt: string
    user: { id: string; name: string; email: string; avatarSeed: number }
  }
  roles: RoleOption[]
  workload: { open: number; done: number; total: number }
  isSelf: boolean
  canManage: boolean
  maxOpen: number
}) {
  const router = useRouter()
  const [roleState, roleAction] = useActionState(updateMemberRoleAction, EMPTY_STATE)
  const [removeState, removeAction] = useActionState(removeMemberAction, EMPTY_STATE)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // El rol actual puede no estar entre los asignables: quien mira no tiene sus
  // permisos, así que no podría concederlo. Se añade solo para que el
  // desplegable no muestre a esta persona con un rol que no es el suyo.
  const opciones = roles.some((role) => role.id === membership.role.id)
    ? roles
    : [{ ...membership.role, description: '' }, ...roles]

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={membership.user.name} seed={membership.user.avatarSeed} size="lg" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {membership.user.name}
              {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(tú)</span>}
            </p>
            <Badge className={roleColor(membership.role.colorSeed).chip}>
              {membership.role.name}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{membership.user.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={(workload.open / maxOpen) * 100} className="h-1 max-w-32" />
            <span className="tabular text-[10px] text-muted-foreground">
              {plural(workload.open, 'abierta')}
            </span>
          </div>
        </div>

        {canManage ? (
          <div className="flex items-center gap-2">
            <form action={roleAction}>
              <input type="hidden" name="membershipId" value={membership.id} />
              <RoleSelect
                name="roleId"
                roles={opciones}
                defaultValue={membership.role.id}
                aria-label={`Rol de ${membership.user.name}`}
                className="w-auto py-1.5 text-xs"
                // Cambiar el desplegable envía el formulario: un botón
                // "Guardar" por fila sería ruido en una lista larga.
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
              />
            </form>

            {!isSelf && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                aria-label={`Quitar a ${membership.user.name} del equipo`}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Desde {membership.joinedAt}</span>
        )}
      </div>

      {roleState.message && (
        <div className="mt-3">
          <FormMessage ok={roleState.ok}>{roleState.message}</FormMessage>
        </div>
      )}
      {removeState.message && !removeState.ok && (
        <div className="mt-3">
          <FormMessage>{removeState.message}</FormMessage>
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Quitar a ${membership.user.name}`}
        description="Perderá el acceso a esta organización y sus tareas asignadas quedarán sin responsable. Su cuenta no se borra."
      >
        <form
          action={(formData) => {
            setConfirmOpen(false)
            removeAction(formData)
            router.refresh()
          }}
          className="flex justify-end gap-2"
        >
          <input type="hidden" name="membershipId" value={membership.id} />
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancelar
          </button>
          <SubmitButton variant="destructive" pendingLabel="Quitando…">
            Quitar del equipo
          </SubmitButton>
        </form>
      </Dialog>
    </li>
  )
}
