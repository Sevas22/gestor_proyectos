'use server'

import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { assertProjectInOrg, requirePermission, PermissionError } from '@/lib/dal'
import { storySchema, fieldErrors, type ActionState } from '@/lib/validation'

function toState(error: unknown): ActionState {
  if (error instanceof PermissionError) return { ok: false, message: error.message }
  if (error instanceof Error && error.message.includes('no pertenece')) {
    return { ok: false, message: error.message }
  }
  console.error('[stories]', error)
  return { ok: false, message: 'No se pudo completar la operación.' }
}

function readForm(formData: FormData) {
  return {
    title: formData.get('title'),
    asA: formData.get('asA') ?? '',
    iWant: formData.get('iWant') ?? '',
    soThat: formData.get('soThat') ?? '',
    description: formData.get('description') ?? '',
    projectId: formData.get('projectId'),
    status: formData.get('status') ?? 'PLANNED',
    colorSeed: formData.get('colorSeed') ?? 0,
    startDate: formData.get('startDate') ?? '',
    endDate: formData.get('endDate') ?? '',
  }
}

export async function createStoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = storySchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  const { projectId, ...rest } = parsed.data
  let createdId = ''

  try {
    const viewer = await requirePermission('story:create')
    await assertProjectInOrg(projectId, viewer.orgId)

    createdId = await prisma.$transaction(async (tx) => {
      // El correlativo va dentro de la transacción para que dos historias
      // creadas a la vez no compartan número.
      const last = await tx.story.findFirst({
        where: { projectId },
        orderBy: { number: 'desc' },
        select: { number: true },
      })

      const story = await tx.story.create({
        data: { ...rest, projectId, number: (last?.number ?? 0) + 1, createdById: viewer.id },
        select: { id: true, number: true, title: true, project: { select: { key: true } } },
      })

      await tx.activity.create({
        data: {
          type: 'PROJECT_UPDATED',
          summary: `creó la historia ${story.project.key}-H${story.number}: ${story.title}`,
          actorId: viewer.id,
          orgId: viewer.orgId,
          projectId,
        },
      })

      return story.id
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}/cronograma`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
  return { ok: true, message: 'Historia creada.', createdId }
}

export async function updateStoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  const parsed = storySchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  const { projectId, ...rest } = parsed.data

  try {
    const viewer = await requirePermission('story:update')
    await assertProjectInOrg(projectId, viewer.orgId)

    // El filtro por orgId es lo que impide editar la historia de otro equipo
    // conociendo su id.
    const existing = await prisma.story.findFirst({
      where: { id, project: { orgId: viewer.orgId } },
      select: { id: true },
    })
    if (!existing) return { ok: false, message: 'Esa historia no existe en tu organización.' }

    const story = await prisma.story.update({
      where: { id },
      data: { ...rest, projectId },
      select: { number: true, title: true, project: { select: { key: true } } },
    })

    await prisma.activity.create({
      data: {
        type: 'PROJECT_UPDATED',
        summary: `actualizó la historia ${story.project.key}-H${story.number}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}/cronograma`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
  return { ok: true, message: 'Historia actualizada.' }
}

export async function deleteStoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')

  let projectId = ''
  try {
    const viewer = await requirePermission('story:delete')

    const story = await prisma.story.findFirst({
      where: { id, project: { orgId: viewer.orgId } },
      select: {
        id: true,
        number: true,
        title: true,
        projectId: true,
        project: { select: { key: true } },
        _count: { select: { tasks: true } },
      },
    })
    if (!story) return { ok: false, message: 'Esa historia no existe en tu organización.' }

    projectId = story.projectId
    const tareas = story._count.tasks

    // onDelete: SetNull en Task.storyId — las tareas sobreviven, sueltas.
    await prisma.story.delete({ where: { id } })

    await prisma.activity.create({
      data: {
        type: 'PROJECT_UPDATED',
        summary:
          tareas > 0
            ? `eliminó la historia ${story.project.key}-H${story.number}; sus ${tareas} ${tareas === 1 ? 'tarea sigue' : 'tareas siguen'} en el tablero`
            : `eliminó la historia ${story.project.key}-H${story.number}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath(`/projects/${projectId}/cronograma`)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, message: 'Historia eliminada.' }
}

/// Mueve una historia en el cronograma conservando su duración.
///
/// Va aparte de updateStoryAction porque arrastrar una barra es un gesto
/// distinto de editar el texto: solo cambia cuándo, no qué.
export async function moveStoryAction(storyId: string, startDate: Date, endDate: Date) {
  const viewer = await requirePermission('story:update')

  const story = await prisma.story.findFirst({
    where: { id: storyId, project: { orgId: viewer.orgId } },
    select: { id: true, projectId: true },
  })
  if (!story) throw new Error('Esa historia no existe en tu organización.')
  if (endDate < startDate) throw new Error('La fecha de fin no puede ser anterior a la de inicio.')

  await prisma.story.update({ where: { id: storyId }, data: { startDate, endDate } })

  revalidatePath(`/projects/${story.projectId}/cronograma`)
}
