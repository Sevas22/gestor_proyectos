'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { requirePermission, PermissionError } from '@/lib/dal'
import { LOCKOUT_PERMISSIONS, permissionsBeyond } from '@/lib/permissions'
import { memberInviteSchema, memberRoleSchema, orgSchema, fieldErrors, type ActionState } from '@/lib/validation'

/// Comprueba que el rol pertenece a la organización. Sin esto, un id de rol de
/// otro equipo serviría para colar permisos ajenos.
async function roleInOrg(roleId: string, orgId: string) {
  const role = await prisma.teamRole.findFirst({
    where: { id: roleId, orgId },
    select: { id: true, name: true, permissions: true },
  })
  if (!role) throw new Error('Ese rol no existe en tu organización.')
  return role
}

/// Impide que el equipo se quede sin nadie capaz de gestionar roles y miembros.
///
/// Antes bastaba con contar cuántos tenían el rol ADMIN. Con roles propios el
/// nombre no significa nada: lo que importa es quién conserva los permisos que
/// permiten arreglar el reparto. `nextPermissions` es null cuando se está
/// retirando a la persona del equipo.
async function assertKeepsAnAdmin(
  orgId: string,
  membershipId: string,
  nextPermissions: string[] | null,
) {
  const activos = await prisma.membership.findMany({
    where: { orgId, status: 'ACTIVE' },
    select: { id: true, role: { select: { permissions: true } } },
  })

  const quedaAlguien = activos.some((m) => {
    const permisos = m.id === membershipId ? nextPermissions : m.role.permissions
    return permisos !== null && LOCKOUT_PERMISSIONS.every((p) => permisos.includes(p))
  })

  if (!quedaAlguien) {
    throw new Error(
      'Con ese cambio nadie del equipo podría gestionar roles ni miembros. Deja al menos una persona con esos permisos.',
    )
  }
}

function toState(error: unknown): ActionState {
  if (error instanceof Error && error.message.startsWith('Con ese cambio')) {
    return { ok: false, message: error.message }
  }
  if (error instanceof Error && error.message.includes('no existe en tu organización')) {
    return { ok: false, message: error.message }
  }
  if (error instanceof PermissionError) return { ok: false, message: error.message }
  console.error('[members]', error)
  return { ok: false, message: 'No se pudo completar la operación.' }
}

/// Alta de un miembro.
///
/// No hay servidor de correo, así que en vez de mandar una invitación se crea la
/// cuenta con una contraseña temporal que se devuelve una sola vez, para que
/// quien administra se la entregue a la persona por el canal que prefiera.
/// Si el correo ya tiene cuenta, simplemente se le añade a la organización.
export async function inviteMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = memberInviteSchema.safeParse({
    email: formData.get('email'),
    roleId: formData.get('roleId'),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  const { email, roleId } = parsed.data

  try {
    const viewer = await requirePermission('member:invite')

    const role = await roleInOrg(roleId, viewer.orgId)

    // No se puede repartir un permiso que uno no tiene, o el alta de miembros
    // se convertiría en una vía de escalada de privilegios.
    const negados = permissionsBeyond(role.permissions, viewer.permissions)
    if (negados.length > 0) {
      return {
        ok: false,
        message: `«${role.name}» incluye permisos que tú no tienes, así que no puedes asignarlo.`,
      }
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    })

    if (existing) {
      const already = await prisma.membership.findUnique({
        where: { userId_orgId: { userId: existing.id, orgId: viewer.orgId } },
        select: { id: true, status: true },
      })
      if (already) {
        return {
          ok: false,
          errors: {
            email: [
              already.status === 'PENDING'
                ? 'Esa persona ya pidió entrar. Apruébala en la lista de solicitudes.'
                : 'Esa persona ya está en el equipo.',
            ],
          },
        }
      }

      await prisma.membership.create({
        // Alta hecha por un administrador: ya está aprobada de origen.
        data: { userId: existing.id, orgId: viewer.orgId, roleId: role.id, status: 'ACTIVE' },
      })
      await prisma.activity.create({
        data: {
          type: 'MEMBER_JOINED',
          summary: `añadió a ${existing.name} como ${role.name}`,
          actorId: viewer.id,
          orgId: viewer.orgId,
        },
      })
      revalidatePath('/team')
      return { ok: true, message: `${existing.name} ya tenía cuenta y se añadió al equipo.` }
    }

    // Contraseña temporal legible pero no adivinable.
    const temporaryPassword = `${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`
    const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(temporaryPassword, 12),
        avatarSeed: Math.floor(Math.random() * 8),
        memberships: { create: { orgId: viewer.orgId, roleId: role.id, status: 'ACTIVE' } },
      },
      select: { id: true, name: true },
    })

    await prisma.activity.create({
      data: {
        type: 'MEMBER_JOINED',
        summary: `invitó a ${user.name} como ${role.name}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
      },
    })

    revalidatePath('/team')
    return {
      ok: true,
      message: `Cuenta creada para ${email}. Contraseña temporal: ${temporaryPassword} — anótala, no se vuelve a mostrar.`,
    }
  } catch (error) {
    return toState(error)
  }
}

export async function updateMemberRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = memberRoleSchema.safeParse({
    membershipId: formData.get('membershipId'),
    roleId: formData.get('roleId'),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  try {
    const viewer = await requirePermission('member:update_role')
    const membership = await prisma.membership.findFirst({
      where: { id: parsed.data.membershipId, orgId: viewer.orgId, status: 'ACTIVE' },
      select: { id: true, roleId: true, userId: true, user: { select: { name: true } } },
    })
    if (!membership) return { ok: false, message: 'Ese miembro no existe en tu organización.' }

    const role = await roleInOrg(parsed.data.roleId, viewer.orgId)

    const negados = permissionsBeyond(role.permissions, viewer.permissions)
    if (negados.length > 0) {
      return {
        ok: false,
        message: `«${role.name}» incluye permisos que tú no tienes, así que no puedes asignarlo.`,
      }
    }

    await assertKeepsAnAdmin(viewer.orgId, membership.id, role.permissions)

    await prisma.membership.update({ where: { id: membership.id }, data: { roleId: role.id } })
    await prisma.activity.create({
      data: {
        type: 'MEMBER_ROLE_CHANGED',
        summary: `cambió el rol de ${membership.user.name} a ${role.name}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/team')
  return { ok: true, message: 'Rol actualizado.' }
}

export async function removeMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membershipId = String(formData.get('membershipId') ?? '')

  try {
    const viewer = await requirePermission('member:remove')
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, orgId: viewer.orgId, status: 'ACTIVE' },
      select: { id: true, userId: true, user: { select: { name: true } } },
    })
    if (!membership) return { ok: false, message: 'Ese miembro no existe en tu organización.' }

    if (membership.userId === viewer.id) {
      return { ok: false, message: 'No puedes quitarte a ti mismo del equipo.' }
    }

    await assertKeepsAnAdmin(viewer.orgId, membership.id, null)

    // Se borra la membresía, no la cuenta: la persona puede estar en otros equipos.
    // Sus tareas asignadas quedan sin responsable (onDelete: SetNull).
    await prisma.membership.delete({ where: { id: membership.id } })
    await prisma.task.updateMany({
      where: { assigneeId: membership.userId, project: { orgId: viewer.orgId } },
      data: { assigneeId: null },
    })
    await prisma.activity.create({
      data: {
        type: 'MEMBER_REMOVED',
        summary: `quitó a ${membership.user.name} del equipo`,
        actorId: viewer.id,
        orgId: viewer.orgId,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/team')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Miembro retirado del equipo.' }
}

export async function updateOrgAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = orgSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return fieldErrors(parsed.error)

  try {
    const viewer = await requirePermission('org:update')
    await prisma.organization.update({ where: { id: viewer.orgId }, data: { name: parsed.data.name } })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Organización actualizada.' }
}

/// Aprueba una solicitud de entrada y le fija el rol definitivo.
///
/// Aprobar y asignar rol son el mismo gesto a propósito: separarlos dejaría un
/// hueco en el que alguien queda dentro del equipo sin que nadie haya decidido
/// qué puede hacer.
export async function approveMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = memberRoleSchema.safeParse({
    membershipId: formData.get('membershipId'),
    roleId: formData.get('roleId'),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  try {
    const viewer = await requirePermission('member:approve')
    const role = await roleInOrg(parsed.data.roleId, viewer.orgId)

    const negados = permissionsBeyond(role.permissions, viewer.permissions)
    if (negados.length > 0) {
      return {
        ok: false,
        message: `«${role.name}» incluye permisos que tú no tienes, así que no puedes asignarlo.`,
      }
    }

    const membership = await prisma.membership.findFirst({
      where: { id: parsed.data.membershipId, orgId: viewer.orgId, status: 'PENDING' },
      select: { id: true, user: { select: { name: true } } },
    })
    // Filtrar por PENDING evita además que dos administradores aprueben a la vez
    // y el segundo reescriba el rol que puso el primero sin enterarse.
    if (!membership) {
      return { ok: false, message: 'Esa solicitud ya no existe o alguien la resolvió antes.' }
    }

    await prisma.membership.update({
      where: { id: membership.id },
      data: { status: 'ACTIVE', roleId: role.id, joinedAt: new Date() },
    })
    await prisma.activity.create({
      data: {
        type: 'MEMBER_JOINED',
        summary: `aprobó a ${membership.user.name} como ${role.name}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/team')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Solicitud aprobada.' }
}

/// Rechaza una solicitud. Borra la membresía, no la cuenta: la persona conserva
/// su usuario y podría volver a pedir entrada, o entrar a otro equipo.
export async function rejectMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membershipId = String(formData.get('membershipId') ?? '')

  try {
    const viewer = await requirePermission('member:approve')

    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, orgId: viewer.orgId, status: 'PENDING' },
      select: { id: true, user: { select: { name: true } } },
    })
    if (!membership) {
      return { ok: false, message: 'Esa solicitud ya no existe o alguien la resolvió antes.' }
    }

    await prisma.membership.delete({ where: { id: membership.id } })
    await prisma.activity.create({
      data: {
        type: 'MEMBER_REMOVED',
        summary: `rechazó la solicitud de ${membership.user.name}`,
        actorId: viewer.id,
        orgId: viewer.orgId,
      },
    })
  } catch (error) {
    return toState(error)
  }

  revalidatePath('/team')
  return { ok: true, message: 'Solicitud rechazada.' }
}
