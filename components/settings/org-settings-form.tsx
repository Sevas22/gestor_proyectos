'use client'

import { useActionState } from 'react'

import { updateOrgAction } from '@/app/actions/members'
import { EMPTY_STATE } from '@/lib/validation'
import { Field, FormMessage, Input } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export function OrgSettingsForm({ defaultName }: { defaultName: string }) {
  const [state, formAction] = useActionState(updateOrgAction, EMPTY_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Nombre de la organización" htmlFor="org-name" error={state.errors?.name}>
        <Input id="org-name" name="name" required defaultValue={defaultName} maxLength={80} />
      </Field>

      {state.message && <FormMessage ok={state.ok}>{state.message}</FormMessage>}

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
      </div>
    </form>
  )
}
