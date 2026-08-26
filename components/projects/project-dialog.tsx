'use client'

import { useActionState, useEffect, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { ProjectStatus } from '@prisma/client'

import { createProjectAction, updateProjectAction } from '@/app/actions/projects'
import { EMPTY_STATE } from '@/lib/validation'
import { PROJECT_STATUS_LABELS, projectColor, toDateInputValue } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Dialog } from '@/components/ui/dialog'
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

type ProjectValues = {
  id: string
  name: string
  key: string
  description: string
  status: ProjectStatus
  colorSeed: number
  dueDate: Date | null
}

/// Sirve para crear y para editar. Si recibe `project`, edita; si no, crea.
export function ProjectDialog({
  trigger,
  project,
  unstyledTrigger,
}: {
  trigger: ReactNode
  project?: ProjectValues
  unstyledTrigger?: boolean
}) {
  const [open, setOpen] = useState(false)
  const editing = Boolean(project)
  const [state, formAction] = useActionState(
    editing ? updateProjectAction : createProjectAction,
    EMPTY_STATE,
  )
  const [colorSeed, setColorSeed] = useState(project?.colorSeed ?? 0)

  // Al crear, la acción redirige y el diálogo desaparece con la navegación.
  // Al editar no hay redirección, así que se cierra aquí cuando sale bien.
  useEffect(() => {
    if (state.ok && editing) setOpen(false)
  }, [state.ok, editing])

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
        title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}
        description={
          editing
            ? 'Los cambios se aplican de inmediato para todo el equipo.'
            : 'La clave es el prefijo de las tareas: WEB-1, WEB-2, y así.'
        }
      >
        <form action={formAction} className="flex flex-col gap-4">
          {project && <input type="hidden" name="id" value={project.id} />}
          <input type="hidden" name="colorSeed" value={colorSeed} />

          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field label="Nombre" htmlFor="name" error={state.errors?.name}>
              <Input
                id="name"
                name="name"
                required
                defaultValue={project?.name}
                placeholder="Portal web"
              />
            </Field>
            <Field
              label="Clave"
              htmlFor="key"
              hint="2–8 letras"
              error={state.errors?.key}
            >
              <Input
                id="key"
                name="key"
                required
                maxLength={8}
                defaultValue={project?.key}
                placeholder="WEB"
                className="font-mono uppercase"
              />
            </Field>
          </div>

          <Field label="Descripción" htmlFor="description" error={state.errors?.description}>
            <Textarea
              id="description"
              name="description"
              defaultValue={project?.description}
              placeholder="Qué abarca este proyecto y qué queda fuera."
              className="min-h-20"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado" htmlFor="status" error={state.errors?.status}>
              <Select id="status" name="status" defaultValue={project?.status ?? 'ACTIVE'}>
                {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {PROJECT_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Fecha límite"
              htmlFor="dueDate"
              hint="Opcional"
              error={state.errors?.dueDate}
            >
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={toDateInputValue(project?.dueDate)}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold">Color</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Color del proyecto">
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
                    projectColor(seed).bg,
                    colorSeed === seed
                      ? 'ring-2 ring-ring ring-offset-2 ring-offset-card'
                      : 'hover:scale-110',
                  )}
                />
              ))}
            </div>
          </div>

          {state.message && <FormMessage ok={state.ok}>{state.message}</FormMessage>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <SubmitButton pendingLabel="Guardando…">
              {editing ? 'Guardar cambios' : 'Crear proyecto'}
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
