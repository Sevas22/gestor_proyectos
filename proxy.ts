import { NextResponse, type NextRequest } from 'next/server'

import { decryptSession, SESSION_COOKIE_NAME } from '@/lib/session'

// En Next.js 16 el antiguo middleware.ts se llama proxy.ts. El comportamiento
// es el mismo.
//
// Esto es una comprobación optimista: solo mira la cookie, sin tocar la base de
// datos, porque se ejecuta en cada navegación incluyendo las precargadas. Sirve
// para no pintar pantallas que el usuario no puede ver. La autorización real
// está en lib/dal.ts, pegada a los datos.

const PROTECTED_PREFIXES = ['/dashboard', '/projects', '/tasks', '/team', '/settings']
const AUTH_ROUTES = ['/login', '/register']

// /logout y /pendiente no aparecen en ninguna de las dos listas a propósito.
//
// /logout tiene que pasar de largo aunque haya cookie, porque su trabajo es
// precisamente borrarla: tratarlo como ruta de autenticación lo devolvería a
// /dashboard y la cookie huérfana nunca se limpiaría.
//
// /pendiente necesita sesión pero no acceso al equipo, y el proxy no puede
// distinguir una cosa de otra sin consultar la base. Lo decide lib/dal.ts.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const isAuthRoute = AUTH_ROUTES.includes(pathname)
  if (!isProtected && !isAuthRoute) return NextResponse.next()

  const session = await decryptSession(request.cookies.get(SESSION_COOKIE_NAME)?.value)

  if (isProtected && !session) {
    const url = new URL('/login', request.url)
    // Para devolver al usuario a donde iba después de identificarse.
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
