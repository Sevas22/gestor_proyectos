import { NextResponse, type NextRequest } from 'next/server'

import { SESSION_COOKIE_NAME } from '@/lib/session'

/// Cierra la sesión borrando la cookie y devuelve a la pantalla de acceso.
///
/// Existe como route handler porque un componente de servidor no puede escribir
/// cookies. Aquí acaba quien tiene una cookie con la firma correcta pero cuya
/// fila ya no está en la base: si no se borrara, el proxy la seguiría dando por
/// buena y rebotaría contra la capa de datos indefinidamente.
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?expired=1', request.url))
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
