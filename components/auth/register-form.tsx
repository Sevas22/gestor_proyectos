'use client'

import { useActionState } from 'react'

import { registerAction } from '@/app/actions/auth'
import { EMPTY_STATE } from '@/lib/validation'
import { Field, FormMessage, Input } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, EMPTY_STATE)

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <Field label="Tu nombre" htmlFor="name" error={state.errors?.name}>
        <Input id="name" name="name" autoComplete="name" required placeholder="Ana Martínez" />
      </Field>

      <Field label="Nombre del equipo" htmlFor="orgName" error={state.errors?.orgName}>
        <Input id="orgName" name="orgName" required placeholder="Acme Cloud" />
      </Field>

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

      <Field
        label="Contraseña"
        htmlFor="password"
        hint="Mínimo 8 caracteres."
        error={state.errors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
      </Field>

      <Field label="Repite la contraseña" htmlFor="confirmPassword" error={state.errors?.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
        />
      </Field>

      {state.message && <FormMessage ok={state.ok}>{state.message}</FormMessage>}

      <SubmitButton className="mt-2 w-full" pendingLabel="Creando…">
        Crear equipo
      </SubmitButton>
    </form>
  )
}
