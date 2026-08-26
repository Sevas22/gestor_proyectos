'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock3, X } from 'lucide-react'
import type { Role } from '@prisma/client'

import { approveMemberAction, rejectMemberAction } from '@/app/actions/members'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '@/lib/permissions'
import { EMPTY_STATE } from '@/lib/validation'
import { relativeTime } from '@/lib/format'
import { Avatar, FormMessage, Select } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export type PendingRequest = {
  id: string
  joinedAt: Date
  user: { id: string; name: string; email: string; avatarSeed: number }
}

/// Una solicitud. Aprobar exige elegir rol en el mismo gesto: si se pudiera
/// aprobar «y ya luego le pongo el rol», habría gente dentro del equipo sin que
/// nadie hubiera decidido qué puede tocar.
function RequestRow({ request, canPromoteToAdmin }: { request: PendingRequest; canPromoteToAdmin: boolean }) {
  const router = useRouter()
  const [role, setRole] = useState<Role>('DEVELOPER')
  const [approveState, approve] = useActionState(approveMemberAction, EMPTY_STATE)
  const [rejectState, reject] = useActionState(rejectMemberAction, EMPTY_STATE)

  const resolved = approveState.ok || rejectState.ok
  useEffect(() => {
    if (resolved) router.refresh()
  }, [resolved, router])

  const roles = ROLE_ORDER.filter((value) => value !== 'ADMIN' || canPromoteToAdmin)
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
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            aria-label={`Rol para ${request.user.name}`}
            className="w-auto py-1.5 text-xs"
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </Select>

          <form action={approve}>
            <input type="hidden" name="membershipId" value={request.id} />
            <input type="hidden" name="role" value={role} />
            <SubmitButton className="px-3 py-1.5 text-xs" pendingLabel="Aprobando…">
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

      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>

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
  canPromoteToAdmin,
}: {
  requests: PendingRequest[]
  canPromoteToAdmin: boolean
}) {
  return (
    <ul className="divide-y divide-border">
      {requests.map((request) => (
        <RequestRow key={request.id} request={request} canPromoteToAdmin={canPromoteToAdmin} />
      ))}
    </ul>
  )
}
