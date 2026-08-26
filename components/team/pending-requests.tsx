'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock3, X } from 'lucide-react'

import { approveMemberAction, rejectMemberAction } from '@/app/actions/members'
import { EMPTY_STATE } from '@/lib/validation'
import { relativeTime } from '@/lib/format'
import { Avatar, FormMessage } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'
import { RoleSelect, type RoleOption } from '@/components/team/role-select'

export type PendingRequest = {
  id: string
  joinedAt: Date
  user: { id: string; name: string; email: string; avatarSeed: number }
}

/// Una solicitud. Aprobar exige elegir rol en el mismo gesto: si se pudiera
/// aprobar «y ya luego le pongo el rol», habría gente dentro del equipo sin que
/// nadie hubiera decidido qué puede tocar.
function RequestRow({ request, roles }: { request: PendingRequest; roles: RoleOption[] }) {
  const router = useRouter()
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '')
  const [approveState, approve] = useActionState(approveMemberAction, EMPTY_STATE)
  const [rejectState, reject] = useActionState(rejectMemberAction, EMPTY_STATE)

  const resolved = approveState.ok || rejectState.ok
  useEffect(() => {
    if (resolved) router.refresh()
  }, [resolved, router])

  const seleccionado = roles.find((role) => role.id === roleId)
  const error = (!approveState.ok && approveState.message) || (!rejectState.ok && rejectState.message)

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={request.user.name} seed={request.user.avatarSeed} size="lg" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{request.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{request.user.email}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" />
            Solicitado {relativeTime(request.joinedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RoleSelect
            roles={roles}
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            aria-label={`Rol para ${request.user.name}`}
            className="w-auto py-1.5 text-xs"
          />

          <form action={approve}>
            <input type="hidden" name="membershipId" value={request.id} />
            <input type="hidden" name="roleId" value={roleId} />
            <SubmitButton
              className="px-3 py-1.5 text-xs"
              pendingLabel="Aprobando…"
              disabled={roles.length === 0}
            >
              <Check className="size-3.5" />
              Aprobar
            </SubmitButton>
          </form>

          <form action={reject}>
            <input type="hidden" name="membershipId" value={request.id} />
            <SubmitButton
              variant="destructive"
              className="px-3 py-1.5 text-xs"
              pendingLabel="Rechazando…"
            >
              <X className="size-3.5" />
              Rechazar
            </SubmitButton>
          </form>
        </div>
      </div>

      {seleccionado?.description && (
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{seleccionado.description}</p>
      )}

      {error && (
        <div className="mt-3">
          <FormMessage>{error}</FormMessage>
        </div>
      )}
    </li>
  )
}

export function PendingRequests({
  requests,
  roles,
}: {
  requests: PendingRequest[]
  roles: RoleOption[]
}) {
  return (
    <ul className="divide-y divide-border">
      {requests.map((request) => (
        <RequestRow key={request.id} request={request} roles={roles} />
      ))}
    </ul>
  )
}
