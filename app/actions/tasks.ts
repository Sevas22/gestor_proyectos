'use server'

import { revalidatePath } from 'next/cache'
import { TaskStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { assertProjectInOrg, assertTaskInOrg, requirePermission, PermissionError } from '@/lib/dal'
import { taskSchema, fieldErrors, type ActionState } from '@/lib/validation'
import { FIRST_BOARD_STATUS, TASK_STATUS_LABELS } from '@/lib/format'

function toState(error: unknown): ActionState {
  if (error instanceof PermissionError) return { ok: false, message: error.message }
  if (error instanceof Error && error.message.includes('no pertenece')) {
    return { ok: false, message: error.message }
  }
  console.error('[tasks]', error)
  return { ok: false, message: 'No se pudo completar la operación. Inténtalo de nuevo.' }
}

function readForm(formData: FormData) {
  return {
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    projectId: formData.get('projectId'),
    status: formData.get('status') ?? 'TODO',
    priority: formData.get('priority') ?? 'MEDIUM',
    assigneeIds: formData.getAll('assigneeIds').map(String).filter(Boolean),
    dueDate: formData.get('dueDate') ?? '',
  }
}

/// Comprueba que todos los responsables pertenecen a la organización y están
/// aprobados. Sin esto, un id de usuario cualquiera bastaría para asignarle
/// trabajo a alguien de fuera del equipo.
async function assertAssigneesInOrg(assigneeIds: string[], orgId: string) {
  if (assigneeIds.length === 0) return []
  const activos = await prisma.membership.findMany({
    where: { orgId, status: 'ACTIVE', userId: { in: assigneeIds } },
    select: { userId: true },
  })
  if (activos.length !== assigneeIds.length) {
    throw new Error('Alguna de esas personas no pertenece a tu organización.')
  }
  return assigneeIds
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = taskSchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  const { projectId, assigneeIds, status, ...rest } = parsed.data

  let createdId = ''
  try {
    const viewer = await requirePermission('task:create')
    await assertProjectInOrg(projectId, viewer.orgId)
    await assertAssigneesInOrg(assigneeIds, viewer.orgId)

    createdId = await prisma.$transaction(async (tx) => {
      // El correlativo por proyecto (WEB-1, WEB-2...) se calcula dentro de la
      // transacción para que dos creaciones simultáneas no compartan número.
      const last = await tx.task.findFirst({
        where: { projectId },
        orderBy: { number: 'desc' },
        select: { number: true },
      })
      // La tarjeta nueva entra arriba de su columna: posición menor que todas.
      const first = await tx.task.findFirst({
        where: { projectId, status },
        orderBy: { position: 'asc' },
        select: { position: true },
      })

      const task = await tx.task.create({
        data: {
          ...rest,
          status,
          projectId,
          assignees: { connect: assigneeIds.map((id) => ({ id })) },
          number: (last?.number ?? 0) + 1,
          position: (first?.position ?? 0) - 1,
          createdById: viewer.id,
        },
        select: { id: true, number: true, title: true, project: { select: { key: true } } },
      })

      await tx.activity.create({
        data: {
          type: 'TASK_CREATED',
          summary: `creó ${task.project.key}-${task.number}: ${task.title}`,
          actorId: viewer.id,
          orgId: viewer.orgId,
          projectId,
          taskId: task.id,
        },
      })

      return task.id
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/backlog`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  // El id vuelve al cliente para que pueda subir los archivos que se eligieron
  // en el mismo formulario: un adjunto necesita una tarea a la que engancharse.
  return { ok: true, message: 'Tarea creada.', createdId }
}

export async function updateTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  const parsed = taskSchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  const { projectId, assigneeIds, ...rest } = parsed.data

  try {
    const viewer = await requirePermission('task:update')
    const existing = await assertTaskInOrg(id, viewer.orgId)
    await assertProjectInOrg(projectId, viewer.orgId)
    await assertAssigneesInOrg(assigneeIds, viewer.orgId)

    const task = await prisma.task.update({
      where: { id },
      // `set` y no `connect`: la lista que llega es la definitiva, así que
      // desmarcar a alguien en el formulario tiene que quitarlo de verdad.
      data: { ...rest, projectId, assignees: { set: assigneeIds.map((id) => ({ id })) } },
      select: { id: true, number: true, title: true, status: true, project: { select: { key: true } } },
    })

    const label = `${task.project.key}-${task.number}`
    const movedColumn = existing.status !== task.status
    await prisma.activity.create({
      data: {
        type: movedColumn ? 'TASK_STATUS_CHANGED' : 'TASK_UPDATED',
        summary: movedColumn
          ? `movió ${label} a ${TASK_STATUS_LABELS[task.status]}`
          : `actualizó ${label}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId,
        taskId: task.id,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Tarea actualizada.' }
}

/// Mover una tarjeta en el tablero. Va aparte de updateTaskAction porque el
/// permiso es distinto: un desarrollador puede arrastrar tarjetas aunque no
/// pueda editar el resto de los campos de la tarea.
export async function moveTaskAction(taskId: string, status: TaskStatus, beforeTaskId?: string | null) {
  const viewer = await requirePermission('task:move')
  const existing = await assertTaskInOrg(taskId, viewer.orgId)

  // Se coloca justo encima de la tarjeta ante la que se soltó; si se soltó en
  // un hueco vacío al final, debajo de la última.
  let position: number
  if (beforeTaskId) {
    const target = await prisma.task.findFirst({
      where: { id: beforeTaskId, projectId: existing.projectId, status },
      select: { position: true },
    })
    if (target) {
      const previous = await prisma.task.findFirst({
        where: {
          projectId: existing.projectId,
          status,
          position: { lt: target.position },
          id: { not: taskId },
        },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
      // Punto medio entre la tarjeta anterior y la de destino. Con Float no hace
      // falta reindexar toda la columna en cada movimiento.
      position = previous ? (previous.position + target.position) / 2 : target.position - 1
    } else {
      position = 0
    }
  } else {
    const last = await prisma.task.findFirst({
      where: { projectId: existing.projectId, status, id: { not: taskId } },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    position = (last?.position ?? 0) + 1
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status, position },
    select: { id: true, number: true, project: { select: { key: true } } },
  })

  if (existing.status !== status) {
    await prisma.activity.create({
      data: {
        type: 'TASK_STATUS_CHANGED',
        summary: `movió ${task.project.key}-${task.number} a ${TASK_STATUS_LABELS[status]}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId: existing.projectId,
        taskId: task.id,
      },
    })
  }

  revalidatePath(`/projects/${existing.projectId}`)
  revalidatePath(`/projects/${existing.projectId}/backlog`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
}

export async function deleteTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')

  let projectId = ''
  try {
    const viewer = await requirePermission('task:delete')
    const existing = await assertTaskInOrg(id, viewer.orgId)
    projectId = existing.projectId

    await prisma.task.delete({ where: { id } })
    await prisma.activity.create({
      data: {
        type: 'TASK_DELETED',
        summary: `eliminó ${existing.project.key}-${existing.number}: ${existing.title}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Tarea eliminada.' }
}

/// Saca un elemento del backlog y lo mete en el tablero, al final de la primera
/// columna.
///
/// Es su propia acción y no una llamada a moveTaskAction porque el gesto es
/// distinto: allí se arrastra a un sitio concreto, aquí se promociona sin
/// decidir todavía dónde encaja. El permiso es el mismo, task:move.
export async function promoteFromBacklogAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')

  let projectId = ''
  try {
    const viewer = await requirePermission('task:move')
    const existing = await assertTaskInOrg(id, viewer.orgId)
    projectId = existing.projectId

    if (existing.status !== 'BACKLOG') {
      return { ok: false, message: 'Esa tarea ya está en el tablero.' }
    }

    const last = await prisma.task.findFirst({
      where: { projectId, status: FIRST_BOARD_STATUS },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const task = await prisma.task.update({
      where: { id },
      data: { status: FIRST_BOARD_STATUS, position: (last?.position ?? 0) + 1 },
      select: { id: true, number: true, project: { select: { key: true } } },
    })

    await prisma.activity.create({
      data: {
        type: 'TASK_STATUS_CHANGED',
        summary: `sacó ${task.project.key}-${task.number} del backlog a ${TASK_STATUS_LABELS[FIRST_BOARD_STATUS]}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId,
        taskId: task.id,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/backlog`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Movida al tablero.' }
}

/// Devuelve una tarea del tablero al backlog. El camino de vuelta: si algo se
/// planificó antes de tiempo, no hay que borrarlo para sacarlo del tablero.
export async function sendToBacklogAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')

  let projectId = ''
  try {
    const viewer = await requirePermission('task:move')
    const existing = await assertTaskInOrg(id, viewer.orgId)
    projectId = existing.projectId

    if (existing.status === 'BACKLOG') {
      return { ok: false, message: 'Esa tarea ya está en el backlog.' }
    }

    const last = await prisma.task.findFirst({
      where: { projectId, status: 'BACKLOG' },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const task = await prisma.task.update({
      where: { id },
      data: { status: 'BACKLOG', position: (last?.position ?? 0) + 1 },
      select: { id: true, number: true, project: { select: { key: true } } },
    })

    await prisma.activity.create({
      data: {
        type: 'TASK_STATUS_CHANGED',
        summary: `devolvió ${task.project.key}-${task.number} al backlog`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId,
        taskId: task.id,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/backlog`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Devuelta al backlog.' }
}
