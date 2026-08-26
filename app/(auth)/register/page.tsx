import type { Metadata } from 'next'
import Link from 'next/link'

import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Crear equipo' }

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Crea tu equipo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu cuenta y tu organización se crean a la vez. Quedas como administrador y desde ahí invitas
        al resto.
      </p>

      <RegisterForm />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  )
}
