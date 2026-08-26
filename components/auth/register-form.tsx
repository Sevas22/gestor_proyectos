'use client'

import { useActionState, useState } from 'react'
import { Building2, UserPlus } from 'lucide-react'

import { registerAction } from '@/app/actions/auth'
import { EMPTY_STATE } from '@/lib/validation'
import { cn } from '@/lib/utils'
import { Field, FormMessage, Input } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

type Mode = 'join' | 'create'

const MODES: { value: Mode; label: string; icon: typeof Building2; hint: string }[] = [
  {
    value: 'join',
    label: 'Unirme a un equipo',
    icon: UserPlus,
    hint: 'Necesitas el código que te dé quien administra el equipo. Tu solicitud queda en espera hasta que te aprueben.',
  },
  {
    value: 'create',
    label: 'Crear un equipo',
    icon: Building2,
    hint: 'Creas la organización desde cero y quedas como su administrador. Podrás aprobar a quien pida entrar.',
  },
]

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, EMPTY_STATE)
  // Unirse es lo que hará la mayoría: crear equipo lo hace una persona una vez,
  // y el resto se suma.
  const [mode, setMode] = useState<Mode>('join')

  const active = MODES.find((m) => m.value === mode)!

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />

      <div className="flex flex-col gap-2">
        <div
          className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1"
          role="radiogroup"
          aria-label="Tipo de registro"
        >
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                mode === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">{active.hint}</p>
      </div>

      <Field label="Tu nombre" htmlFor="name" error={state.errors?.name}>
        <Input id="name" name="name" autoComplete="name" required placeholder="Ana Martínez" />
      </Field>

      {mode === 'join' ? (
        <Field
          label="Código del equipo"
          htmlFor="teamCode"
          hint="Se lo pides a quien administra el equipo."
          error={state.errors?.teamCode}
        >
          <Input
            id="teamCode"
            name="teamCode"
            required
            placeholder="acme-cloud"
            className="font-mono lowercase"
          />
        </Field>
      ) : (
        <Field label="Nombre del equipo" htmlFor="orgName" error={state.errors?.orgName}>
          <Input id="orgName" name="orgName" required placeholder="Acme Cloud" />
        </Field>
      )}

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

      <SubmitButton className="mt-2 w-full" pendingLabel="Enviando…">
        {mode === 'join' ? 'Pedir acceso' : 'Crear equipo'}
      </SubmitButton>
    </form>
  )
}
