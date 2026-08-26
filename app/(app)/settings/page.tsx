import type { Metadata } from 'next'
import { Settings2, ShieldCheck } from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER, can } from '@/lib/permissions'
import { ROLE_STYLES, formatDate } from '@/lib/format'
import { PageHeader } from '@/components/shell/app-shell'
import { Badge, Card, CardHeader } from '@/components/ui/primitives'
import { OrgSettingsForm } from '@/components/settings/org-settings-form'

export const metadata: Metadata = { title: 'Ajustes' }

export default async function SettingsPage() {
  const viewer = await requireViewer()
  const org = await prisma.organization.findUnique({
    where: { id: viewer.orgId },
    select: {
      name: true,
      slug: true,
      createdAt: true,
      _count: { select: { members: true, projects: true } },
    },
  })

  const canEdit = can(viewer.role, 'org:update')

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
            subtitle={canEdit ? 'Cambia el nombre visible del equipo' : 'Solo un administrador puede editarlo'}
          />
          <div className="p-5">
            {canEdit ? (
              <OrgSettingsForm defaultName={org?.name ?? ''} />
            ) : (
              <p className="text-sm font-medium">{org?.name}</p>
            )}

            <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
              {[
                ['Identificador', org?.slug ?? '—'],
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
              <dd>
                <Badge className={ROLE_STYLES[viewer.role]}>{ROLE_LABELS[viewer.role]}</Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Matriz de permisos"
            subtitle="Lo que el servidor autoriza para cada rol"
            action={<ShieldCheck className="size-4 text-muted-foreground" />}
          />
          <ul className="divide-y divide-border">
            {ROLE_ORDER.map((role) => (
              <li key={role} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                <div className="sm:w-44">
                  <Badge className={ROLE_STYLES[role]}>{ROLE_LABELS[role]}</Badge>
                </div>
                <p className="flex-1 text-xs leading-5 text-muted-foreground">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
