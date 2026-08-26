import { SignJWT, jwtVerify } from 'jose'

// Firma y verificación del token de sesión.
//
// Este módulo se mantiene puro a propósito — sin 'server-only' y sin
// next/headers — porque también lo importa proxy.ts, que se ejecuta en el
// runtime edge. Todo lo que toca cookies vive en lib/session-cookie.ts.

export const SESSION_COOKIE_NAME = 'gestor_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 días

export type SessionPayload = {
  userId: string
  /// Organización activa. Va en la sesión para no consultarla en cada request.
  orgId: string
}

function secretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      'Falta SESSION_SECRET en .env. Genérala con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    )
  }
  return new TextEncoder().encode(secret)
}

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey())
}

/// Devuelve null en vez de lanzar: una cookie caducada o manipulada es un caso
/// esperado, no un fallo del servidor.
export async function decryptSession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (typeof payload.userId !== 'string' || typeof payload.orgId !== 'string') return null
    return { userId: payload.userId, orgId: payload.orgId }
  } catch {
    return null
  }
}
