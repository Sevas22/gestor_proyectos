'use server'

import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { assertTaskInOrg, requirePermission, requireViewer, PermissionError } from '@/lib/dal'
import { can } from '@/lib/permissions'
import { validateAttachment } from '@/lib/attachments'
import type { ActionState } from '@/lib/validation'

function toState(error: unknown): ActionState {
  if (error instanceof PermissionError) return { ok: false, message: error.message }
  if (error instanceof Error && error.message.includes('no pertenece')) {
    return { ok: false, message: error.message }
  }
  console.error('[attachments]', error)
  return { ok: false, message: 'No se pudo subir el archivo.' }
}

export async function uploadAttachmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const taskId = String(formData.get('taskId') ?? '')
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return { ok: false, message: 'Elige un archivo.' }
  }

  // Se valida antes de leer el contenido: si el tipo o el tamaño no valen, no
  // tiene sentido cargar megabytes en memoria para descartarlos después.
  const check = validateAttachment(file)
  if (!check.ok) return { ok: false, message: check.message }

  let projectId = ''
  try {
    const viewer = await requirePermission('attachment:upload')
    const task = await assertTaskInOrg(taskId, viewer.orgId)
    projectId = task.projectId

    const data = Buffer.from(await file.arrayBuffer())

    // El tamaño real del buffer manda sobre file.size, que viene del navegador.
    if (data.byteLength !== check.size) {
      return { ok: false, message: 'El archivo llegó incompleto. Inténtalo de nuevo.' }
    }

    await prisma.attachment.create({
      data: {
        filename: check.filename,
        mimeType: check.mimeType,
        size: data.byteLength,
        data,
        taskId: task.id,
        uploadedById: viewer.id,
      },
      select: { id: true },
    })

    await prisma.activity.create({
      data: {
        type: 'TASK_UPDATED',
        summary: `adjuntó ${check.filename} a ${task.project.key}-${task.number}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId: task.projectId,
        taskId: task.id,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/backlog`)
  return { ok: true, message: 'Archivo adjuntado.' }
}

export async function deleteAttachmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')

  let projectId = ''
  try {
    const viewer = await requireViewer()

    const attachment = await prisma.attachment.findFirst({
      // El filtro por orgId es lo que impide borrar el adjunto de otra
      // organización conociendo su id.
      where: { id, task: { project: { orgId: viewer.orgId } } },
      select: { id: true, filename: true, uploadedById: true, task: { select: { projectId: true } } },
    })
    if (!attachment) return { ok: false, message: 'Ese archivo ya no existe.' }

    // Mismo criterio que en los comentarios: lo tuyo siempre; lo de otro, con
    // permiso.
    const esSuyo = attachment.uploadedById === viewer.id
    if (!esSuyo && !can(viewer.permissions, 'attachment:delete')) {
      return { ok: false, message: 'Solo puedes eliminar los archivos que tú subiste.' }
    }

    projectId = attachment.task.projectId
    await prisma.attachment.delete({ where: { id } })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/backlog`)
  return { ok: true, message: 'Archivo eliminado.' }
}
