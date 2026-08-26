import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { decryptSession } from '@/lib/session'
import { readSessionCookie } from '@/lib/session-cookie'
import { can, isPermission, type Permission } from '@/lib/permissions'

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
  /// El rol es ahora una fila de la organización, no un valor fijo. Se lleva
  /// resuelto en el viewer —nombre para mostrar y permisos para decidir— para
  /// que ninguna pantalla tenga que volver a consultarlo.
  roleId: string
  roleName: string
  roleColorSeed: number
  permissions: Permission[]
  orgId: string
  orgName: string
  orgSlug: string
}

/// Cuatro desenlaces, no dos. El proxy solo mira la firma de la cookie, así que
/// no distingue entre tener sesión y tener acceso; esta capa sí, y cada caso va
/// a un sitio distinto:
///
///   anonymous  sin cookie                    → /login
///   stale      firma buena, fila ausente     → /logout, que borra la cookie
///   pending    fila existe, sin aprobar      → /pendiente
///   ok         acceso completo
///
/// Separar `stale` es lo que evita un bucle infinito: el proxy daría por buena
/// una cookie huérfana y mandaría al panel mientras esta capa manda a /login,
/// contradiciéndose para siempre. Hay que borrarla, no solo redirigir.
export type ViewerResult =
  | { status: 'anonymous' }
  | { status: 'stale' }
  /// Cuenta creada y sesión válida, pero nadie le ha dado el visto bueno
  /// todavía. Se devuelve lo mínimo para pintar la sala de espera: nombre de
  /// la organización a la que pidió entrar y desde cuándo espera. Ni un dato
  /// del equipo.
  | { status: 'pending'; orgName: string; since: Date }
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
      status: true,
      joinedAt: true,
      role: { select: { id: true, name: true, colorSeed: true, permissions: true } },
      org: { select: { id: true, name: true, slug: true } },
      user: { select: { id: true, name: true, email: true, avatarSeed: true } },
    },
  })

  // Firma buena, fila ausente: le sacaron del equipo, se borró la organización
  // o se reinició la base de datos con la sesión abierta.
  if (!membership) return { status: 'stale' }

  // Una membresía pendiente tiene rol asignado en la fila, pero ese rol es solo
  // la propuesta inicial: no autoriza nada hasta que un administrador aprueba.
  if (membership.status === 'PENDING') {
    return { status: 'pending', orgName: membership.org.name, since: membership.joinedAt }
  }

  return {
    status: 'ok',
    viewer: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      avatarSeed: membership.user.avatarSeed,
      roleId: membership.role.id,
      roleName: membership.role.name,
      roleColorSeed: membership.role.colorSeed,
      // Se filtra contra el catálogo: una clave que quedó en la base tras
      // retirarse del producto no debe colarse como permiso válido.
      permissions: membership.role.permissions.filter(isPermission),
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
  if (result.status === 'stale') return '/logout'
  if (result.status === 'pending') return '/pendiente'
  return '/login'
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
  if (!can(viewer.permissions, permission)) throw new PermissionError(permission)
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
