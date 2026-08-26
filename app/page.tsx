import { redirect } from 'next/navigation'

import { destinationFor, resolveViewer } from '@/lib/dal'

/// La raíz no tiene contenido propio: manda al panel si hay sesión y a la
/// pantalla de acceso si no. Una cookie huérfana se manda a /logout para que se
/// borre, en vez de a /login, donde el proxy la devolvería al panel.
export default async function RootPage() {
  const result = await resolveViewer()
  redirect(result.status === 'ok' ? '/dashboard' : destinationFor(result))
}
