import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { decryptSession } from '@/lib/session'
import { readSessionCookie } from '@/lib/session-cookie'
import { can, type Permission } from '@/lib/permissions'

/// Capa de acceso a datos.
///
/// El proxy (proxy.ts) sólo hace una comprobación optimista sobre la cookie para
/// evitar pintar pantallas que el usuario no puede ver. La autorización que
/// cuenta es esta: se ejecuta pegada a la base de datos, así que también protege
/// las server actions, a las que se puede llamar por POST sin pasar por la interfaz.

export type Viewer = {
  id: string
  name: string
  email: string
  avatarSeed: number
  role: Role
  orgId: string
  orgName: string
  orgSlug: string
}

/// Tres desenlaces, no dos. Distinguir «no hay cookie» de «la cookie ya no
/// corresponde a nadie» es lo que evita un bucle de redirecciones: el proxy solo
/// mira la firma, así que da por buena una cookie caducada de contenido y manda
/// a /dashboard, mientras esta capa mandaría a /login. Uno y otro se
/// contradirían para siempre. La cookie huérfana hay que borrarla.
export type ViewerResult =
  | { status: 'anonymous' }
  | { status: 'stale' }
  | { status: 'ok'; viewer: Viewer }

/// Lee la sesión y resuelve el usuario junto con su rol en la organización activa.
/// `cache` la memoiza dentro de un mismo render: la llaman el layout y varias
/// páginas, pero solo hace una consulta.
export const resolveViewer = cache(async (): Promise<ViewerResult> => {
  const session = await decryptSession(await readSessionCookie())
  if (!session) return { status: 'anonymous' }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.userId, orgId: session.orgId } },
    select: {
      role: true,
      org: { select: { id: true, name: true, slug: true } },
      user: { select: { id: true, name: true, email: true, avatarSeed: true } },
    },
  })

  // Firma buena, fila ausente: le sacaron del equipo, se borró la organización
  // o se reinició la base de datos con la sesión abierta.
  if (!membership) return { status: 'stale' }

  return {
    status: 'ok',
    viewer: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      avatarSeed: membership.user.avatarSeed,
      role: membership.role,
      orgId: membership.org.id,
      orgName: membership.org.name,
      orgSlug: membership.org.slug,
    },
  }
})

export async function getViewer(): Promise<Viewer | null> {
  const result = await resolveViewer()
  return result.status === 'ok' ? result.viewer : null
}

/// A dónde mandar a quien no tiene sesión utilizable. /logout es un route
/// handler, que sí puede borrar la cookie; un componente de servidor no puede.
export function destinationFor(result: ViewerResult): string {
  return result.status === 'stale' ? '/logout' : '/login'
}

/// Igual que getViewer pero corta la ejecución si no hay sesión. Para páginas
/// y layouts protegidos.
export async function requireViewer(): Promise<Viewer> {
  const result = await resolveViewer()
  if (result.status !== 'ok') redirect(destinationFor(result))
  return result.viewer
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`No tienes permiso para realizar esta acción (${permission}).`)
    this.name = 'PermissionError'
  }
}

/// Para server actions: devuelve el viewer sólo si su rol autoriza la acción.
export async function requirePermission(permission: Permission): Promise<Viewer> {
  const viewer = await requireViewer()
  if (!can(viewer.role, permission)) throw new PermissionError(permission)
  return viewer
}

/// Comprueba que un proyecto pertenece a la organización del viewer.
/// Sin esto, un id de otra organización sería suficiente para leer o escribir
/// datos ajenos.
export async function assertProjectInOrg(projectId: string, orgId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: { id: true },
  })
  if (!project) throw new Error('El proyecto no existe o no pertenece a tu organización.')
  return project.id
}

/// Igual que assertProjectInOrg pero partiendo de una tarea.
export async function assertTaskInOrg(taskId: string, orgId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { orgId } },
    select: { id: true, projectId: true, number: true, title: true, status: true, project: { select: { key: true } } },
  })
  if (!task) throw new Error('La tarea no existe o no pertenece a tu organización.')
  return task
}
