'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { requirePermission, PermissionError } from '@/lib/dal'
import { LOCKOUT_PERMISSIONS, permissionsBeyond, type Permission } from '@/lib/permissions'
import { roleSchema, fieldErrors, type ActionState } from '@/lib/validation'

function toState(error: unknown): ActionState {
  if (error instanceof PermissionError) return { ok: false, message: error.message }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return { ok: false, errors: { name: ['Ya existe un rol con ese nombre en tu equipo.'] } }
  }
  console.error('[roles]', error)
  return { ok: false, message: 'No se pudo completar la operación.' }
}

function readForm(formData: FormData) {
  return {
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    colorSeed: formData.get('colorSeed') ?? 0,
    // Las casillas marcadas llegan repetidas bajo el mismo nombre.
    permissions: formData.getAll('permissions').map(String),
  }
}

/// Comprueba que la organización no se quede sin nadie capaz de gestionar roles
/// y miembros. Se ejecuta antes de guardar, simulando cómo quedaría el reparto.
async function assertNoLockout(
  orgId: string,
  change: { roleId: string; permissions?: Permission[]; deleting?: boolean },
) {
  const roles = await prisma.teamRole.findMany({
    where: { orgId },
    select: {
      id: true,
      permissions: true,
      _count: { select: { members: { where: { status: 'ACTIVE' } } } },
    },
  })

  const quedaAlguien = roles.some((role) => {
    if (role.id === change.roleId) {
      if (change.deleting) return false
      const permisos = change.permissions ?? (role.permissions as Permission[])
      return role._count.members > 0 && LOCKOUT_PERMISSIONS.every((p) => permisos.includes(p))
    }
    return (
      role._count.members > 0 &&
      LOCKOUT_PERMISSIONS.every((p) => (role.permissions as string[]).includes(p))
    )
  })

  if (!quedaAlguien) {
    throw new Error(
      'Con ese cambio nadie del equipo podría gestionar roles ni miembros, y la organización quedaría bloqueada. Deja al menos una persona con esos dos permisos.',
    )
  }
}

export async function createRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = roleSchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  try {
    const viewer = await requirePermission('role:manage')

    const negados = permissionsBeyond(parsed.data.permissions, viewer.permissions)
    if (negados.length > 0) {
      return {
        ok: false,
        message: `No puedes conceder permisos que tú no tienes: ${negados.join(', ')}.`,
      }
    }

    await prisma.teamRole.create({
      data: { ...parsed.data, orgId: viewer.orgId, isSystem: false },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/roles')
  revalidatePath('/team')
  return { ok: true, message: 'Rol creado.' }
}

export async function updateRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')
  const parsed = roleSchema.safeParse(readForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  try {
    const viewer = await requirePermission('role:manage')

    const role = await prisma.teamRole.findFirst({
      where: { id, orgId: viewer.orgId },
      select: { id: true, isSystem: true, permissions: true },
    })
    if (!role) return { ok: false, message: 'Ese rol no existe en tu organización.' }

    // Solo se comprueban los permisos que se están añadiendo: quitar uno que no
    // tienes es inofensivo, y bloquearlo impediría recortar un rol heredado.
    const añadidos = parsed.data.permissions.filter(
      (p) => !(role.permissions as string[]).includes(p),
    )
    const negados = permissionsBeyond(añadidos, viewer.permissions)
    if (negados.length > 0) {
      return {
        ok: false,
        message: `No puedes conceder permisos que tú no tienes: ${negados.join(', ')}.`,
      }
    }

    if (role.isSystem) {
      const faltan = LOCKOUT_PERMISSIONS.filter((p) => !parsed.data.permissions.includes(p))
      if (faltan.length > 0) {
        return {
          ok: false,
          message:
            'Este es el rol administrador de la organización: no puede quedarse sin gestionar roles ni miembros. Puedes cambiarle el nombre y el resto de permisos.',
        }
      }
    }

    await assertNoLockout(viewer.orgId, { roleId: id, permissions: parsed.data.permissions })

    await prisma.teamRole.update({ where: { id }, data: parsed.data })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/roles')
  revalidatePath('/team')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Rol actualizado.' }
}

export async function deleteRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '')

  try {
    const viewer = await requirePermission('role:manage')

    const role = await prisma.teamRole.findFirst({
      where: { id, orgId: viewer.orgId },
      select: { id: true, name: true, isSystem: true, _count: { select: { members: true } } },
    })
    if (!role) return { ok: false, message: 'Ese rol no existe en tu organización.' }

    if (role.isSystem) {
      return { ok: false, message: 'El rol administrador de la organización no se puede eliminar.' }
    }
    // La relación es onDelete: Restrict, así que la base también lo impediría.
    // Comprobarlo aquí permite explicar por qué en vez de soltar un error de FK.
    if (role._count.members > 0) {
      return {
        ok: false,
        message: `«${role.name}» lo tienen ${role._count.members} ${role._count.members === 1 ? 'persona' : 'personas'}. Cámbiales el rol antes de eliminarlo.`,
      }
    }

    await assertNoLockout(viewer.orgId, { roleId: id, deleting: true })

    await prisma.teamRole.delete({ where: { id } })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/roles')
  revalidatePath('/team')
  return { ok: true, message: 'Rol eliminado.' }
}
