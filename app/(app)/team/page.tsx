import type { Metadata } from 'next'
import { Clock3, ShieldCheck, Users } from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import { can, permissionsBeyond, summarizePermissions } from '@/lib/permissions'
import { getOrgMembers, getOrgRoles, getPendingMembers, getWorkload } from '@/lib/queries'
import { formatDate, plural, roleColor } from '@/lib/format'
import { PageHeader } from '@/components/shell/app-shell'
import { Avatar, Badge, Card, CardHeader, EmptyState, Progress } from '@/components/ui/primitives'
import { InviteMemberDialog } from '@/components/team/invite-member-dialog'
import { MemberRow } from '@/components/team/member-row'
import { PendingRequests } from '@/components/team/pending-requests'
import { TeamCode } from '@/components/team/team-code'

export const metadata: Metadata = { title: 'Equipo' }

export default async function TeamPage() {
  const viewer = await requireViewer()
  const canApprove = can(viewer.permissions, 'member:approve')
  const [members, workload, pending, roles] = await Promise.all([
    getOrgMembers(viewer.orgId),
    getWorkload(viewer.orgId),
    // Solo se consultan las solicitudes si quien mira puede resolverlas.
    canApprove ? getPendingMembers(viewer.orgId) : Promise.resolve([]),
    getOrgRoles(viewer.orgId),
  ])

  // Solo se ofrecen los roles que quien mira podría conceder: repartir permisos
  // que uno no tiene sería escalar privilegios, y el servidor lo rechazaría.
  const asignables = roles
    .filter((role) => permissionsBeyond(role.permissions, viewer.permissions).length === 0)
    .map((role) => ({ id: role.id, name: role.name, colorSeed: role.colorSeed, description: role.description }))

  const canInvite = can(viewer.permissions, 'member:invite')
  const canManage = can(viewer.permissions, 'member:update_role')
  const workloadById = new Map(workload.map((entry) => [entry.id, entry]))
  const maxOpen = Math.max(...workload.map((entry) => entry.open), 1)

  return (
    <div className="mx-auto max-w-[1400px] p-5 sm:p-8">
      <PageHeader
        eyebrow={
          <>
            <Users className="size-3.5" />
            {viewer.orgName}
          </>
        }
        title="Equipo"
        description="Quién está en la organización, con qué rol y cuánto trabajo tiene abierto."
        action={canInvite ? <InviteMemberDialog roles={asignables} /> : undefined}
      />

      {canApprove && (
        <div className="mb-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <Card className="overflow-hidden">
            <CardHeader
              title="Solicitudes de entrada"
              subtitle={
                pending.length === 0
                  ? 'No hay ninguna esperando'
                  : `${plural(pending.length, 'persona espera', 'personas esperan')} tu aprobación`
              }
              action={
                pending.length > 0 ? (
                  <span className="tabular flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <Clock3 className="size-3" />
                    {pending.length}
                  </span>
                ) : undefined
              }
            />
            {pending.length === 0 ? (
              <EmptyState
                icon={<Clock3 className="size-5" />}
                title="Nadie esperando"
                description="Cuando alguien se registre con el código del equipo, su solicitud aparecerá aquí para que le asignes un rol."
              />
            ) : (
              <PendingRequests requests={pending} roles={asignables} />
            )}
          </Card>

          <TeamCode code={viewer.orgSlug} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Miembros"
            subtitle={plural(members.length, 'persona')}
          />
          <ul className="divide-y divide-border">
            {members.map((member) => (
              <MemberRow
                key={member.id}
                membership={{
                  id: member.id,
                  role: member.role,
                  joinedAt: formatDate(member.joinedAt),
                  user: member.user,
                }}
                roles={asignables}
                workload={workloadById.get(member.user.id) ?? { open: 0, done: 0, total: 0 }}
                isSelf={member.user.id === viewer.id}
                canManage={canManage}
                maxOpen={maxOpen}
              />
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Roles y permisos"
            subtitle={`${plural(roles.length, 'rol', 'roles')} en este equipo`}
            action={<ShieldCheck className="size-4 text-muted-foreground" />}
          />
          <ul className="divide-y divide-border">
            {roles.map((role) => {
              const color = roleColor(role.colorSeed)
              return (
                <li key={role.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={color.chip}>{role.name}</Badge>
                    <span className="tabular text-[11px] text-muted-foreground">
                      {plural(role._count.members, 'persona')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {role.description || summarizePermissions(role.permissions)}
                  </p>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-border bg-accent/40 px-5 py-4">
            <p className="text-[11px] leading-5 text-muted-foreground">
              Los permisos se comprueban en el servidor antes de cada cambio, no solo en la
              interfaz. Un observador no puede crear ni modificar nada aunque llame directamente a
              la API.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Carga de trabajo" subtitle="Tareas abiertas y cerradas por persona" />
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
          {workload.map((person) => (
            <div key={person.id} className="bg-card p-5">
              <div className="flex items-center gap-3">
                <Avatar name={person.name} seed={person.avatarSeed} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{person.name}</p>
                  <p className="tabular text-[11px] text-muted-foreground">
                    {plural(person.open, 'abierta')} · {person.done} completadas
                  </p>
                </div>
              </div>
              <Progress value={(person.open / maxOpen) * 100} className="mt-4 h-1.5" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
