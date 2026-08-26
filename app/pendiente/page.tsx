import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Clock3, LogOut, RefreshCw } from 'lucide-react'

import { resolveViewer, destinationFor } from '@/lib/dal'
import { logoutAction } from '@/app/actions/auth'
import { relativeTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Pendiente de aprobación' }

/// Sala de espera. Es lo único que ve quien pidió entrar a un equipo y todavía
/// no tiene el visto bueno.
///
/// Deliberadamente no muestra ni un dato de la organización más allá de su
/// nombre —que ya conocía, porque tecleó su código para llegar aquí—. Ni
/// proyectos, ni miembros, ni actividad.
export default async function PendientePage() {
  const result = await resolveViewer()

  // Si ya le aprobaron, esta pantalla no tiene sentido. Y si perdió la sesión,
  // que vaya donde le corresponda: aquí no se queda nadie sin membresía.
  if (result.status !== 'pending') redirect(destinationFor(result))

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <Clock3 className="size-6" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-balance">
          Tu solicitud está en revisión
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Pediste entrar a <span className="font-semibold text-foreground">{result.orgName}</span>{' '}
          {relativeTime(result.since)}. Un administrador del equipo tiene que aprobarte y decidir
          qué rol tendrás. Hasta entonces no puedes ver los proyectos ni las tareas.
        </p>

        <div className="mt-8 rounded-xl border border-border bg-card p-5 text-left">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Qué pasa ahora
          </p>
          <ol className="mt-3 flex flex-col gap-2.5 text-sm leading-6 text-muted-foreground">
            <li className="flex gap-2.5">
              <span className="tabular font-mono text-xs text-primary">1</span>
              Quien administra el equipo ve tu solicitud en su pantalla de Equipo.
            </li>
            <li className="flex gap-2.5">
              <span className="tabular font-mono text-xs text-primary">2</span>
              Te asigna un rol, y con eso quedas dentro.
            </li>
            <li className="flex gap-2.5">
              <span className="tabular font-mono text-xs text-primary">3</span>
              Recarga esta página para comprobarlo.
            </li>
          </ol>
        </div>

        <p className="mt-6 text-xs leading-5 text-muted-foreground">
          Si crees que te equivocaste de equipo, cierra la sesión y vuelve a registrarte con el
          código correcto.
        </p>

        <div className="mt-5 flex items-center justify-center gap-2">
          {/* Un enlace normal, no un botón con JavaScript: recargar es
              exactamente lo que hace falta para volver a consultar el estado. */}
          <a
            href="/pendiente"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="size-4" />
            Comprobar de nuevo
          </a>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
