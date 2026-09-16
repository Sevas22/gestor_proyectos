'use client'

import { useActionState } from 'react'

import { changePasswordAction } from '@/app/actions/auth'
import { EMPTY_STATE } from '@/lib/validation'
import { Field, FormMessage, Input } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, EMPTY_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Contraseña actual"
        htmlFor="current-password"
        hint="Si te dieron una temporal, es esa."
        error={state.errors?.currentPassword}
      >
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          // Los gestores de contraseñas distinguen la actual de la nueva por
          // este atributo: con él proponen guardar la nueva en vez de pisarla.
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nueva contraseña"
          htmlFor="new-password"
          hint="Al menos 8 caracteres."
          error={state.errors?.password}
        >
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={200}
            required
          />
        </Field>
        <Field
          label="Repite la nueva"
          htmlFor="confirm-password"
          error={state.errors?.confirmPassword}
        >
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
      </div>

      {state.message && <FormMessage ok={state.ok}>{state.message}</FormMessage>}

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Cambiando…">Cambiar contraseña</SubmitButton>
      </div>
    </form>
  )
}
