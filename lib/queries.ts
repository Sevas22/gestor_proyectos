import 'server-only'

import { cache } from 'react'
import { TaskStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// Consultas de lectura. Todas reciben orgId y filtran por él: es la frontera que
// impide que una organización vea los datos de otra.

/// Datos que necesita cualquier tarjeta o fila que muestre una tarea.
const taskCard = {
  id: true,
  number: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  position: true,
  dueDate: true,
  updatedAt: true,
  projectId: true,
  assigneeId: true,
  project: { select: { id: true, key: true, name: true, colorSeed: true } },
  assignee: { select: { id: true, name: true, avatarSeed: true } },
  _count: { select: { comments: true } },
} as const

export type TaskCard = Awaited<ReturnType<typeof getProjectTasks>>[number]

/// Solo miembros aprobados. Alimenta la lista del equipo y el desplegable de
/// responsables: si colara alguien pendiente, se le podrían asignar tareas
/// antes de que nadie le haya dado acceso.
export const getOrgMembers = cache(async (orgId: string) => {
  return prisma.membership.findMany({
    where: { orgId, status: 'ACTIVE' },
    orderBy: [{ role: { colorSeed: 'asc' } }, { user: { name: 'asc' } }],
    select: {
      id: true,
      role: { select: { id: true, name: true, colorSeed: true, permissions: true } },
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, avatarSeed: true } },
    },
  })
})

/// Solicitudes de entrada esperando aprobación, las más antiguas primero:
/// quien lleva más tiempo esperando debería resolverse antes.
export const getPendingMembers = cache(async (orgId: string) => {
  return prisma.membership.findMany({
    where: { orgId, status: 'PENDING' },
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true,
      role: { select: { id: true, name: true, colorSeed: true, permissions: true } },
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, avatarSeed: true } },
    },
  })
})

/// Roles de la organización, con el recuento de miembros activos que los
/// llevan. El recuento es lo que decide si un rol se puede borrar.
export const getOrgRoles = cache(async (orgId: string) => {
  return prisma.teamRole.findMany({
    where: { orgId },
    orderBy: [{ colorSeed: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      permissions: true,
      colorSeed: true,
      isSystem: true,
      createdAt: true,
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    },
  })
})

export const getProjects = cache(async (orgId: string) => {
  const projects = await prisma.project.findMany({
    where: { orgId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      status: true,
      colorSeed: true,
      dueDate: true,
      createdAt: true,
      tasks: { select: { status: true, assigneeId: true } },
    },
  })

  // El recuento se calcula aquí y no con _count porque necesitamos el desglose
  // por estado, que _count no sabe dar en una sola consulta.
  // El progreso mide el trabajo comprometido, así que el backlog queda fuera:
  // si contara, añadir ideas al backlog haría bajar el porcentaje de un proyecto
  // en el que nadie ha dejado de avanzar.
  return projects.map(({ tasks, ...project }) => {
    const board = tasks.filter((t) => t.status !== 'BACKLOG')
    const done = board.filter((t) => t.status === 'DONE').length
    return {
      ...project,
      taskCount: board.length,
      doneCount: done,
      backlogCount: tasks.length - board.length,
      progress: board.length === 0 ? 0 : Math.round((done / board.length) * 100),
      memberCount: new Set(board.map((t) => t.assigneeId).filter(Boolean)).size,
    }
  })
})

/// Lista ligera para los selectores de proyecto de los formularios.
export const getProjectOptions = cache(async (orgId: string) => {
  return prisma.project.findMany({
    where: { orgId, status: { not: 'ARCHIVED' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, key: true, colorSeed: true },
  })
})

export const getProject = cache(async (projectId: string, orgId: string) => {
  return prisma.project.findFirst({
    where: { id: projectId, orgId },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      status: true,
      colorSeed: true,
      dueDate: true,
      createdAt: true,
    },
  })
})

/// Tareas del tablero. Excluye el backlog: son cosas que el equipo aún no se ha
/// comprometido a hacer, y meterlas en el Kanban lo ahogaría.
export const getProjectTasks = cache(async (projectId: string, orgId: string) => {
  return prisma.task.findMany({
    where: { projectId, project: { orgId }, status: { not: 'BACKLOG' } },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    select: taskCard,
  })
})

/// El backlog del proyecto, en el orden que le haya dado el equipo.
export const getProjectBacklog = cache(async (projectId: string, orgId: string) => {
  return prisma.task.findMany({
    where: { projectId, project: { orgId }, status: 'BACKLOG' },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    select: taskCard,
  })
})

/// Tareas de toda la organización, con filtros opcionales. Alimenta /tasks.
export const getOrgTasks = cache(
  async (
    orgId: string,
    filters: { assigneeId?: string; status?: TaskStatus; projectId?: string } = {},
  ) => {
    return prisma.task.findMany({
      where: {
        project: { orgId },
        ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
      take: 200,
      select: taskCard,
    })
  },
)

export const getTaskDetail = cache(async (taskId: string, orgId: string) => {
  return prisma.task.findFirst({
    where: { id: taskId, project: { orgId } },
    select: {
      ...taskCard,
      createdAt: true,
      createdBy: { select: { id: true, name: true, avatarSeed: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          createdAt: true,
          authorId: true,
          author: { select: { id: true, name: true, avatarSeed: true } },
        },
      },
    },
  })
})

export const getActivity = cache(async (orgId: string, limit = 12) => {
  return prisma.activity.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      summary: true,
      createdAt: true,
      projectId: true,
      actor: { select: { id: true, name: true, avatarSeed: true } },
    },
  })
})

/// Métricas de la portada. Una sola pasada de consultas en paralelo.
export const getDashboardStats = cache(async (orgId: string, userId: string) => {
  const [byStatus, total, overdue, mine, projectCount, memberCount, completedThisWeek] =
    await Promise.all([
      prisma.task.groupBy({
        by: ['status'],
        where: { project: { orgId } },
        _count: { _all: true },
      }),
      prisma.task.count({ where: { project: { orgId }, status: { not: 'BACKLOG' } } }),
      prisma.task.count({
        where: {
          project: { orgId },
          status: { notIn: ['DONE', 'BACKLOG'] },
          dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.task.count({
        where: { project: { orgId }, assigneeId: userId, status: { notIn: ['DONE', 'BACKLOG'] } },
      }),
      prisma.project.count({ where: { orgId, status: 'ACTIVE' } }),
      prisma.membership.count({ where: { orgId, status: 'ACTIVE' } }),
      prisma.task.count({
        where: {
          project: { orgId },
          status: 'DONE',
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

  const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Record<
    TaskStatus,
    number | undefined
  >

  const done = counts.DONE ?? 0
  const backlog = counts.BACKLOG ?? 0

  // `total` ya viene sin backlog de la consulta; el resto de recuentos salen del
  // groupBy, que sí lo incluye, y por eso se expone aparte.
  return {
    total,
    backlog,
    todo: counts.TODO ?? 0,
    inProgress: counts.IN_PROGRESS ?? 0,
    inReview: counts.IN_REVIEW ?? 0,
    done,
    open: total - done,
    overdue,
    mine,
    projectCount,
    memberCount,
    completedThisWeek,
    progress: total === 0 ? 0 : Math.round((done / total) * 100),
  }
})

/// Carga de trabajo por persona, para la pantalla de equipo y la portada.
export const getWorkload = cache(async (orgId: string) => {
  const members = await prisma.membership.findMany({
    where: { orgId, status: 'ACTIVE' },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          avatarSeed: true,
          // Sin backlog: la carga de trabajo es lo que alguien tiene entre
          // manos, no lo que quizá le toque algún día.
          assignedTasks: {
            where: { project: { orgId }, status: { not: 'BACKLOG' } },
            select: { status: true },
          },
        },
      },
    },
  })

  return members
    .map(({ user }) => {
      const open = user.assignedTasks.filter((t) => t.status !== 'DONE').length
      return {
        id: user.id,
        name: user.name,
        avatarSeed: user.avatarSeed,
        open,
        done: user.assignedTasks.filter((t) => t.status === 'DONE').length,
        total: user.assignedTasks.length,
      }
    })
    .sort((a, b) => b.open - a.open)
})
