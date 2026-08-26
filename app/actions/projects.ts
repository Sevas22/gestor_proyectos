'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { assertProjectInOrg, requirePermission, PermissionError } from '@/lib/dal'
import { projectSchema, fieldErrors, type ActionState } from '@/lib/validation'

function toState(error: unknown): ActionState {
  if (error instanceof PermissionError) return { ok: false, message: error.message }
  // P2002: violación de índice único. Aquí solo puede ser @@unique([orgId, key]).
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return { ok: false, errors: { key: ['Ya usas esa clave en otro proyecto.'] } }
  }
  console.error('[projects]', error)
  return { ok: false, message: 'No se pudo completar la operación. Inténtalo de nuevo.' }
}

function readForm(formData: FormData) {
  return {
    name: formData.get('name'),
    key: formData.get('key'),
    description: formData.get('description') ?? '',
    status: formData.get('status') ?? 'ACTIVE',
    colorSeed: formData.get('colorSeed') ?? 0,
    dueDate: formData.get('dueDate') ?? '',
  }
}

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = projectSchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  let projectId: string
  try {
    const viewer = await requirePermission('project:create')
    const project = await prisma.project.create({
      data: { ...parsed.data, orgId: viewer.orgId },
      select: { id: true, name: true },
    })
    await prisma.activity.create({
      data: {
        type: 'PROJECT_CREATED',
        summary: `creó el proyecto ${project.name}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId: project.id,
      },
    })
    projectId = project.id
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect(`/projects/${projectId}`)
}

export async function updateProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  const parsed = projectSchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  try {
    const viewer = await requirePermission('project:update')
    await assertProjectInOrg(id, viewer.orgId)
    const project = await prisma.project.update({
      where: { id },
      data: parsed.data,
      select: { id: true, name: true },
    })
    await prisma.activity.create({
      data: {
        type: 'PROJECT_UPDATED',
        summary: `actualizó el proyecto ${project.name}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
        projectId: project.id,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  revalidatePath('/dashboard')
  return { ok: true, message: 'Proyecto actualizado.' }
}

export async function deleteProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')

  try {
    const viewer = await requirePermission('project:delete')
    await assertProjectInOrg(id, viewer.orgId)
    // onDelete: Cascade en Task y Comment se encarga del resto.
    await prisma.project.delete({ where: { id } })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect('/projects')
}
