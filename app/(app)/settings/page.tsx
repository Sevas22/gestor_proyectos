import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Settings2, ShieldCheck } from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { can, summarizePermissions } from '@/lib/permissions'
import { getOrgRoles } from '@/lib/queries'
import { formatDate, plural, roleColor } from '@/lib/format'
import { PageHeader } from '@/components/shell/app-shell'
import { Badge, Card, CardHeader } from '@/components/ui/primitives'
import { OrgSettingsForm } from '@/components/settings/org-settings-form'

export const metadata: Metadata = { title: 'Ajustes' }

export default async function SettingsPage() {
  const viewer = await requireViewer()
  const [org, roles] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: viewer.orgId },
      select: {
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { members: true, projects: true } },
      },
    }),
    getOrgRoles(viewer.orgId),
  ])

  const canEdit = can(viewer.permissions, 'org:update')
  const canManageRoles = can(viewer.permissions, 'role:manage')
  const miColor = roleColor(viewer.roleColorSeed)

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8">
      <PageHeader
        eyebrow={
          <>
            <Settings2 className="size-3.5" />
            Administración
          </>
        }
        title="Ajustes"
        description="Datos de la organización y tu cuenta."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title="Organización"
            subtitle={
              canEdit ? 'Cambia el nombre visible del equipo' : 'Tu rol no permite editarlo'
            }
          />
          <div className="p-5">
            {canEdit ? (
              <OrgSettingsForm defaultName={org?.name ?? ''} />
            ) : (
              <p className="text-sm font-medium">{org?.name}</p>
            )}

            <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
              {[
                ['Código del equipo', org?.slug ?? '—'],
                ['Miembros', String(org?._count.members ?? 0)],
                ['Proyectos', String(org?._count.projects ?? 0)],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {term}
                  </dt>
                  <dd className="tabular mt-1 font-mono text-sm">{value}</dd>
                </div>
              ))}
            </dl>
            {org && (
              <p className="mt-4 text-xs text-muted-foreground">
                Creada el {formatDate(org.createdAt)}.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Tu cuenta" subtitle="Cómo te ve el resto del equipo" />
          <dl className="divide-y divide-border">
            {[
              ['Nombre', viewer.name],
              ['Correo', viewer.email],
            ].map(([term, value]) => (
              <div key={term} className="flex items-center justify-between gap-4 px-5 py-4">
                <dt className="text-sm text-muted-foreground">{term}</dt>
                <dd className="truncate text-sm font-medium">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <dt className="text-sm text-muted-foreground">Rol</dt>
              <dd className="flex items-center gap-2">
                <Badge className={miColor.chip}>{viewer.roleName}</Badge>
                <span className="tabular text-[11px] text-muted-foreground">
                  {plural(viewer.permissions.length, 'permiso')}
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Roles del equipo"
            subtitle={`${plural(roles.length, 'rol', 'roles')} configurados`}
            action={
              canManageRoles ? (
                <Link
                  href="/roles"
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Gestionar <ArrowUpRight className="size-3" />
                </Link>
              ) : (
                <ShieldCheck className="size-4 text-muted-foreground" />
              )
            }
          />
          <ul className="divide-y divide-border">
            {roles.map((role) => {
              const color = roleColor(role.colorSeed)
              return (
                <li key={role.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="sm:w-48">
                    <Badge className={color.chip}>{role.name}</Badge>
                  </div>
                  <p className="flex-1 text-xs leading-5 text-muted-foreground">
                    {role.description || summarizePermissions(role.permissions)}
                  </p>
                  <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                    {plural(role._count.members, 'persona')}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-border bg-accent/40 px-5 py-4">
            <p className="text-[11px] leading-5 text-muted-foreground">
              Los permisos se comprueban en el servidor antes de cada cambio, no solo en la
              interfaz. Un rol sin permisos de escritura no puede modificar nada aunque llame
              directamente a la API.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
