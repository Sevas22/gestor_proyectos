'use client'

import { useActionState } from 'react'

import { loginAction } from '@/app/actions/auth'
import { EMPTY_STATE } from '@/lib/validation'
import { Field, FormMessage, Input } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, EMPTY_STATE)

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <Field label="Correo" htmlFor="email" error={state.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@equipo.com"
        />
      </Field>

      <Field label="Contraseña" htmlFor="password" error={state.errors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      {state.message && <FormMessage ok={state.ok}>{state.message}</FormMessage>}

      <SubmitButton className="mt-2 w-full" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  )
}
