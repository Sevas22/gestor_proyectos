'use client'

import { useActionState, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Plus } from 'lucide-react'

import { createRoleAction, updateRoleAction } from '@/app/actions/roles'
import { EMPTY_STATE } from '@/lib/validation'
import {
  PERMISSION_CATALOG,
  SENSITIVE_PERMISSIONS,
  type Permission,
} from '@/lib/permissions'
import { roleColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Dialog } from '@/components/ui/dialog'
import { Field, FormMessage, Input, Textarea } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export type RoleValues = {
  id: string
  name: string
  description: string
  permissions: string[]
  colorSeed: number
  isSystem: boolean
}

/// Crea y edita roles. La lista de casillas sale del catálogo de permisos, así
/// que un permiso nuevo en el producto aparece aquí sin tocar este componente.
///
/// `grantable` son los permisos que quien edita posee: no se pueden conceder
/// los demás, y el servidor lo vuelve a comprobar. Se muestran deshabilitados en
/// vez de ocultos para que se entienda por qué no están disponibles.
export function RoleDialog({
  trigger,
  role,
  grantable,
  unstyledTrigger,
}: {
  trigger: ReactNode
  role?: RoleValues
  grantable: Permission[]
  unstyledTrigger?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const editing = Boolean(role)
  const [state, formAction] = useActionState(
    editing ? updateRoleAction : createRoleAction,
    EMPTY_STATE,
  )
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []))
  const [colorSeed, setColorSeed] = useState(role?.colorSeed ?? 0)

  useEffect(() => {
    if (!state.ok) return
    setOpen(false)
    router.refresh()
    // Solo al cambiar el resultado de la acción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function toggle(permission: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(permission)
      else next.delete(permission)
      return next
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          unstyledTrigger
            ? 'block w-full text-left'
            : 'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90'
        }
      >
        {!unstyledTrigger && <Plus className="size-4" />}
        {trigger}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editing ? `Editar «${role!.name}»` : 'Nuevo rol'}
        description={
          role?.isSystem
            ? 'Es el rol administrador de la organización. Puedes cambiarle el nombre y afinar permisos, pero no dejarlo sin gestionar roles ni miembros.'
            : 'Marca lo que este rol puede hacer. Los cambios afectan de inmediato a quien lo tenga.'
        }
      >
        <form action={formAction} className="flex flex-col gap-5">
          {role && <input type="hidden" name="id" value={role.id} />}
          <input type="hidden" name="colorSeed" value={colorSeed} />

          <Field label="Nombre" htmlFor="role-name" error={state.errors?.name}>
            <Input
              id="role-name"
              name="name"
              required
              maxLength={40}
              defaultValue={role?.name}
              placeholder="Analista de calidad"
            />
          </Field>

          <Field
            label="Descripción"
            htmlFor="role-description"
            hint="Se muestra al asignar el rol. Opcional."
            error={state.errors?.description}
          >
            <Textarea
              id="role-description"
              name="description"
              maxLength={200}
              defaultValue={role?.description}
              placeholder="Qué se espera de quien tenga este rol."
              className="min-h-16"
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold">Color</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Color del rol">
              {[0, 1, 2, 3, 4, 5].map((seed) => (
                <button
                  key={seed}
                  type="button"
                  role="radio"
                  aria-checked={colorSeed === seed}
                  aria-label={`Color ${seed + 1}`}
                  onClick={() => setColorSeed(seed)}
                  className={cn(
                    'size-7 rounded-full transition-transform',
                    roleColor(seed).dot,
                    colorSeed === seed
                      ? 'ring-2 ring-ring ring-offset-2 ring-offset-card'
                      : 'hover:scale-110',
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold">Permisos</span>
              <span className="tabular text-[11px] text-muted-foreground">
                {selected.size} marcados
              </span>
            </div>

            {PERMISSION_CATALOG.map((group) => (
              <fieldset key={group.group} className="rounded-lg border border-border p-4">
                <legend className="px-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  {group.group}
                </legend>
                <p className="mb-3 text-[11px] leading-4 text-muted-foreground">{group.hint}</p>

                <div className="flex flex-col gap-2.5">
                  {group.items.map((item) => {
                    const puede = grantable.includes(item.key)
                    const sensible = SENSITIVE_PERMISSIONS.includes(item.key)
                    return (
                      <label
                        key={item.key}
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5',
                          !puede && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          name="permissions"
                          value={item.key}
                          disabled={!puede}
                          checked={selected.has(item.key)}
                          onChange={(event) => toggle(item.key, event.target.checked)}
                          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                            {item.label}
                            {sensible && (
                              <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="size-2.5" />
                                delicado
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] leading-4 text-muted-foreground">
                            {puede
                              ? item.description
                              : 'Tu rol no tiene este permiso, así que no puedes concederlo.'}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          {state.message && <FormMessage ok={state.ok}>{state.message}</FormMessage>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <SubmitButton pendingLabel="Guardando…">
              {editing ? 'Guardar cambios' : 'Crear rol'}
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
