import type { ReactNode } from 'react'

import { requireViewer } from '@/lib/dal'
import { prisma } from '@/lib/prisma'
import { logoutAction } from '@/app/actions/auth'
import { AppShell } from '@/components/shell/app-shell'

/// Layout de todo el panel. requireViewer redirige a /login si la sesión no es
/// válida, así que ninguna página hija necesita repetir la comprobación para
/// pintarse — aunque cada mutación sí vuelve a verificar permisos.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer()

  const [projectCount, myOpenTasks, memberCount] = await Promise.all([
    prisma.project.count({ where: { orgId: viewer.orgId, status: { not: 'ARCHIVED' } } }),
    prisma.task.count({
      where: { project: { orgId: viewer.orgId }, assigneeId: viewer.id, status: { not: 'DONE' } },
    }),
    prisma.membership.count({ where: { orgId: viewer.orgId } }),
  ])

  return (
    <AppShell
      viewer={viewer}
      counts={{ '/projects': projectCount, '/tasks': myOpenTasks, '/team': memberCount }}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  )
}
