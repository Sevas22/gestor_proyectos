'use server'

import { revalidatePath } from 'next/cache'
import { TaskStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { assertProjectInOrg, assertTaskInOrg, requirePermission, PermissionError } from '@/lib/dal'
import { taskSchema, fieldErrors, type ActionState } from '@/lib/validation'
import { TASK_STATUS_LABELS } from '@/lib/format'

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
    assigneeId: formData.get('assigneeId') ?? '',
    dueDate: formData.get('dueDate') ?? '',
  }
}

/// Comprueba que quien recibe la tarea pertenece a la organización. Sin esto, un
/// id de usuario cualquiera bastaría para asignarle trabajo a alguien de fuera.
async function assertAssigneeInOrg(assigneeId: string | null, orgId: string) {
  if (!assigneeId) return null
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: assigneeId, orgId } },
    select: { userId: true },
  })
  if (!membership) throw new Error('Esa persona no pertenece a tu organización.')
  return assigneeId
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = taskSchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  const { projectId, assigneeId, status, ...rest } = parsed.data

  try {
    const viewer = await requirePermission('task:create')
    await assertProjectInOrg(projectId, viewer.orgId)
    await assertAssigneeInOrg(assigneeId, viewer.orgId)

    await prisma.$transaction(async (tx) => {
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
          assigneeId,
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
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Tarea creada.' }
}

export async function updateTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  const parsed = taskSchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  const { projectId, assigneeId, ...rest } = parsed.data

  try {
    const viewer = await requirePermission('task:update')
    const existing = await assertTaskInOrg(id, viewer.orgId)
    await assertProjectInOrg(projectId, viewer.orgId)
    await assertAssigneeInOrg(assigneeId, viewer.orgId)

    const task = await prisma.task.update({
      where: { id },
      data: { ...rest, projectId, assigneeId },
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
