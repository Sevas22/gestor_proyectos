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
    orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
    select: {
      id: true,
      role: true,
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
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, avatarSeed: true } },
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
  return projects.map(({ tasks, ...project }) => {
    const done = tasks.filter((t) => t.status === 'DONE').length
    return {
      ...project,
      taskCount: tasks.length,
      doneCount: done,
      progress: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
      memberCount: new Set(tasks.map((t) => t.assigneeId).filter(Boolean)).size,
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

export const getProjectTasks = cache(async (projectId: string, orgId: string) => {
  return prisma.task.findMany({
    where: { projectId, project: { orgId } },
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
      prisma.task.count({ where: { project: { orgId } } }),
      prisma.task.count({
        where: {
          project: { orgId },
          status: { not: 'DONE' },
          dueDate: { lt: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.task.count({
        where: { project: { orgId }, assigneeId: userId, status: { not: 'DONE' } },
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

  return {
    total,
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
          assignedTasks: {
            where: { project: { orgId } },
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
