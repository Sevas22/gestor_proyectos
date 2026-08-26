'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { createSession, destroySession } from '@/lib/session-cookie'
import { loginSchema, registerSchema, fieldErrors, type ActionState } from '@/lib/validation'

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

/// Registro: crea la persona, su organización y la membresía de administrador
/// en una sola transacción. Si algo falla, no queda un usuario sin equipo.
export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    orgName: formData.get('orgName'),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  const { name, email, password, orgName } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return { ok: false, errors: { email: ['Ya hay una cuenta con ese correo.'] } }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const slug = await uniqueSlug(slugify(orgName))

  const membership = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        // Color de avatar estable, repartido por la paleta.
        avatarSeed: Math.floor(Math.random() * 8),
      },
      select: { id: true },
    })
    const org = await tx.organization.create({
      data: { name: orgName, slug },
      select: { id: true },
    })
    const created = await tx.membership.create({
      // Quien crea el equipo lo administra.
      data: { userId: user.id, orgId: org.id, role: 'ADMIN' },
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
    return created
  })

  await createSession({ userId: membership.userId, orgId: membership.orgId })
  // redirect lanza una excepción de control interna de Next: va fuera de
  // cualquier try/catch para que no se la trague.
  redirect('/dashboard')
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, memberships: { select: { orgId: true }, take: 1 } },
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

  const orgId = user.memberships[0]?.orgId
  if (!orgId) {
    return { ok: false, message: 'Tu cuenta no pertenece a ninguna organización. Pide que te inviten.' }
  }

  await createSession({ userId: user.id, orgId })
  redirect('/dashboard')
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}
