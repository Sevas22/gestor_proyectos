import 'server-only'

import { cookies } from 'next/headers'

import {
  encryptSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type SessionPayload,
} from '@/lib/session'

// Lectura y escritura de la cookie de sesión. Separado de lib/session.ts para
// que proxy.ts pueda verificar el token sin arrastrar next/headers al edge.

export async function createSession(payload: SessionPayload) {
  const token = await encryptSession(payload)
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // En desarrollo el servidor es http://localhost, y una cookie Secure no
    // viajaría por http.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function readSessionCookie() {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
