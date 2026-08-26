import type { Metadata } from 'next'
import Link from 'next/link'

import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; next?: string }>
}) {
  const { expired } = await searchParams

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Inicia sesión</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Entra para ver los proyectos y tareas de tu equipo.
      </p>

      {/* Llega aquí quien venía de /logout con una cookie huérfana. Sin este
          aviso, verían la pantalla de acceso sin saber por qué les echó. */}
      {expired && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-amber-100 px-3 py-2.5 text-xs leading-5 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Tu sesión ya no es válida. Puede que te hayan retirado del equipo o que
          la organización haya cambiado. Vuelve a entrar.
        </p>
      )}

      <LoginForm />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        ¿Todavía no tienes equipo?{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Crea uno
        </Link>
      </p>
    </div>
  )
}
