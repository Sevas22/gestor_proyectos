'use server'

import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { assertTaskInOrg, requirePermission, requireViewer, PermissionError } from '@/lib/dal'
import { commentSchema, fieldErrors, type ActionState } from '@/lib/validation'
import { can } from '@/lib/permissions'

export async function createCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = commentSchema.safeParse({
    taskId: formData.get('taskId'),
    body: formData.get('body'),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  let projectId = ''
  try {
    const viewer = await requirePermission('comment:create')
    const task = await assertTaskInOrg(parsed.data.taskId, viewer.orgId)
    projectId = task.projectId

    await prisma.comment.create({
      data: { body: parsed.data.body, taskId: task.id, authorId: viewer.id },
    })
    await prisma.activity.create({
      data: {
        type: 'COMMENT_CREATED',
        summary: `comentó en ${task.project.key}-${task.number}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId: task.projectId,
        taskId: task.id,
      },
    })
  } catch (error) {
    if (error instanceof PermissionError) return { ok: false, message: error.message }
    console.error('[comments]', error)
    return { ok: false, message: 'No se pudo publicar el comentario.' }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
  return { ok: true }
}

export async function deleteCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')

  let projectId = ''
  try {
    const viewer = await requireViewer()
    const comment = await prisma.comment.findFirst({
      where: { id, task: { project: { orgId: viewer.orgId } } },
      select: { id: true, authorId: true, task: { select: { projectId: true } } },
    })
    if (!comment) return { ok: false, message: 'Ese comentario ya no existe.' }

    // Cualquiera puede borrar lo que escribió; borrar lo de otro exige permiso.
    const isAuthor = comment.authorId === viewer.id
    if (!isAuthor && !can(viewer.permissions, 'comment:delete')) {
      return { ok: false, message: 'Solo puedes eliminar tus propios comentarios.' }
    }

    projectId = comment.task.projectId
    await prisma.comment.delete({ where: { id } })
  } catch (error) {
    console.error('[comments]', error)
    return { ok: false, message: 'No se pudo eliminar el comentario.' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { ok: true }
}
