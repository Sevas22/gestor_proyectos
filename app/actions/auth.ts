'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { createSession, destroySession } from '@/lib/session-cookie'
import { loginSchema, registerSchema, fieldErrors, type ActionState } from '@/lib/validation'
import { DEFAULT_ROLES, DEFAULT_JOIN_ROLE } from '@/lib/permissions'

const BCRYPT_COST = 12

/// Convierte "Equipo de Diseño" en "equipo-de-diseno".
function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

async function uniqueSlug(base: string) {
  const root = base || 'equipo'
  let candidate = root
  let n = 2
  while (await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${root}-${n++}`
  }
  return candidate
}

/// Registro. Dos caminos según lo que eligió el formulario:
///
///   'create' → nace la organización y quien la crea entra como ADMIN activo.
///   'join'   → se pide entrar a una que ya existe. La membresía nace PENDING:
///              la persona tiene cuenta y sesión, pero no ve ni un dato del
///              equipo hasta que un administrador la aprueba.
export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const mode = formData.get('mode') === 'join' ? 'join' : 'create'
  const parsed = registerSchema.safeParse({
    mode,
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    ...(mode === 'join'
      ? { teamCode: formData.get('teamCode') }
      : { orgName: formData.get('orgName') }),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return { ok: false, errors: { email: ['Ya hay una cuenta con ese correo.'] } }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  // Color de avatar estable, repartido por la paleta.
  const avatarSeed = Math.floor(Math.random() * 8)

  let session: { userId: string; orgId: string }

  if (parsed.data.mode === 'join') {
    const org = await prisma.organization.findUnique({
      where: { slug: parsed.data.teamCode },
      select: {
        id: true,
        name: true,
        roles: { select: { id: true, name: true, permissions: true } },
      },
    })
    if (!org) {
      return {
        ok: false,
        errors: { teamCode: ['No hay ningún equipo con ese código. Compruébalo con quien te lo dio.'] },
      }
    }

    // Rol de partida mientras espera. No concede nada —la membresía está
    // PENDING— pero la fila necesita apuntar a algún rol. Se prefiere el que la
    // organización llame como el rol de entrada por defecto; si le cambiaron el
    // nombre o lo borraron, el de menos permisos, que es el más inocuo.
    const propuesto =
      org.roles.find((r) => r.name === DEFAULT_JOIN_ROLE) ??
      [...org.roles].sort((a, b) => a.permissions.length - b.permissions.length)[0]

    if (!propuesto) {
      return { ok: false, message: 'Ese equipo no tiene roles configurados. Avisa a quien lo administra.' }
    }

    session = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, avatarSeed },
        select: { id: true },
      })
      const membership = await tx.membership.create({
        // El rol es solo la propuesta de partida; mientras esté PENDING no
        // autoriza nada. Quien apruebe decidirá con cuál se queda.
        data: { userId: user.id, orgId: org.id, roleId: propuesto.id, status: 'PENDING' },
        select: { userId: true, orgId: true },
      })
      return membership
    })
  } else {
    const { orgName } = parsed.data
    const slug = await uniqueSlug(slugify(orgName))

    session = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, avatarSeed },
        select: { id: true },
      })
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          // Toda organización nace con un juego de roles editable. Sin esto no
          // habría ninguno al que asignar a nadie.
          roles: { create: DEFAULT_ROLES },
        },
        select: { id: true, roles: { select: { id: true, isSystem: true } } },
      })
      const adminRole = org.roles.find((r) => r.isSystem)!
      const membership = await tx.membership.create({
        // Quien crea el equipo lo administra, y no espera aprobación de nadie.
        data: { userId: user.id, orgId: org.id, roleId: adminRole.id, status: 'ACTIVE' },
        select: { userId: true, orgId: true },
      })
      await tx.activity.create({
        data: {
          type: 'MEMBER_JOINED',
          summary: `creó la organización ${orgName}`,
          actorId: user.id,
          orgId: org.id,
        },
      })
      return membership
    })
  }

  await createSession(session)
  // redirect lanza una excepción de control interna de Next: va fuera de
  // cualquier try/catch para que no se la trague.
  // Quien pidió entrar acaba en la sala de espera; quien creó equipo, en el panel.
  redirect(parsed.data.mode === 'join' ? '/pendiente' : '/dashboard')
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      passwordHash: true,
      // Se traen todas y se elige en código. Ordenar por `status` funcionaría,
      // pero Prisma ordena los enums por su orden de declaración —PENDING antes
      // que ACTIVE—, así que el criterio se rompería en silencio si alguien
      // reordena el enum.
      memberships: { select: { orgId: true, status: true } },
    },
  })

  // Mismo mensaje exista o no la cuenta: decir "ese correo no está registrado"
  // permitiría averiguar quién tiene cuenta.
  const invalid: ActionState = { ok: false, message: 'Correo o contraseña incorrectos.' }
  if (!user) {
    // Gasta el tiempo del hash igualmente para no delatar la diferencia por latencia.
    await bcrypt.compare(parsed.data.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin')
    return invalid
  }

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!matches) return invalid

  // Una membresía aprobada manda sobre una en espera: si alguien está activo en
  // un equipo y pendiente en otro, entra al que ya le dejó pasar.
  const membership =
    user.memberships.find((m) => m.status === 'ACTIVE') ?? user.memberships[0]

  if (!membership) {
    return { ok: false, message: 'Tu cuenta no pertenece a ninguna organización. Pide que te inviten.' }
  }

  await createSession({ userId: user.id, orgId: membership.orgId })
  redirect(membership.status === 'ACTIVE' ? '/dashboard' : '/pendiente')
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}
