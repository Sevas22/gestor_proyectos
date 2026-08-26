import type { Metadata } from 'next'
import { Lock, Plus, ShieldCheck } from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import { can, PERMISSION_CATALOG, isPermission, type Permission } from '@/lib/permissions'
import { getOrgRoles } from '@/lib/queries'
import { plural, roleColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shell/app-shell'
import { Badge, Card, EmptyState } from '@/components/ui/primitives'
import { RoleDialog } from '@/components/roles/role-dialog'
import { DeleteRoleButton } from '@/components/roles/delete-role-button'

export const metadata: Metadata = { title: 'Roles' }

/// Etiqueta legible de cada permiso, sacada del catálogo.
const LABELS = new Map(
  PERMISSION_CATALOG.flatMap((group) => group.items.map((item) => [item.key, item.label] as const)),
)

export default async function RolesPage() {
  const viewer = await requireViewer()
  const roles = await getOrgRoles(viewer.orgId)

  const canManage = can(viewer.permissions, 'role:manage')

  return (
    <div className="mx-auto max-w-[1100px] p-5 sm:p-8">
      <PageHeader
        eyebrow={
          <>
            <ShieldCheck className="size-3.5" />
            {viewer.orgName}
          </>
        }
        title="Roles"
        description="Cada rol es una lista de permisos. El servidor los comprueba antes de cada cambio, así que un rol sin escritura no puede modificar nada aunque llame directamente a la API."
        action={
          canManage ? (
            <RoleDialog trigger="Nuevo rol" grantable={viewer.permissions} />
          ) : undefined
        }
      />

      {!canManage && (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="px-5 py-4 text-xs leading-5 text-amber-900 dark:text-amber-200">
            Tu rol no incluye <strong>Gestionar roles</strong>, así que esta pantalla es solo de
            lectura. Puedes ver cómo está repartido el acceso, pero no cambiarlo.
          </p>
        </Card>
      )}

      <div className="grid gap-4">
        {roles.map((role) => {
          const color = roleColor(role.colorSeed)
          const permisos = role.permissions.filter(isPermission)
          // Los permisos que este rol tiene y quien mira no. Editarlo sería
          // recortarlo sin poder devolverlo a su estado anterior.
          const fueraDeAlcance = permisos.filter((p) => !viewer.permissions.includes(p))
          const editable = canManage && fueraDeAlcance.length === 0

          return (
            <Card key={role.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={color.chip}>{role.name}</Badge>
                    {role.isSystem && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                        <Lock className="size-2.5" />
                        rol de sistema
                      </span>
                    )}
                    <span className="tabular text-[11px] text-muted-foreground">
                      {plural(role._count.members, 'persona')} · {plural(permisos.length, 'permiso')}
                    </span>
                  </div>

                  {role.description && (
                    <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground">
                      {role.description}
                    </p>
                  )}

                  {permisos.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Sin permisos: solo lectura.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {permisos.map((permission) => (
                        <li
                          key={permission}
                          className="rounded-md bg-accent px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          {LABELS.get(permission) ?? permission}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-2">
                    {editable ? (
                      <RoleDialog
                        trigger={
                          <span className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent">
                            Editar
                          </span>
                        }
                        unstyledTrigger
                        grantable={viewer.permissions}
                        role={{
                          id: role.id,
                          name: role.name,
                          description: role.description,
                          permissions: role.permissions,
                          colorSeed: role.colorSeed,
                          isSystem: role.isSystem,
                        }}
                      />
                    ) : (
                      <span
                        title="Este rol incluye permisos que tú no tienes, así que no puedes editarlo."
                        className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
                      >
                        Fuera de tu alcance
                      </span>
                    )}

                    {!role.isSystem && (
                      <DeleteRoleButton
                        roleId={role.id}
                        roleName={role.name}
                        memberCount={role._count.members}
                      />
                    )}
                  </div>
                )}
              </div>
            </Card>
          )
        })}

        {canManage && (
          <RoleDialog
            trigger={
              <span
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-sm text-muted-foreground transition-colors',
                  'hover:border-primary/50 hover:bg-accent/40 hover:text-foreground',
                )}
              >
                <Plus className="size-4" />
                Crear un rol
              </span>
            }
            unstyledTrigger
            grantable={viewer.permissions}
          />
        )}

        {roles.length === 0 && (
          <Card>
            <EmptyState
              icon={<ShieldCheck className="size-5" />}
              title="No hay roles"
              description="Algo fue mal: toda organización debería tener al menos el rol administrador."
            />
          </Card>
        )}
      </div>
    </div>
  )
}
