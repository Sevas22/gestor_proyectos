'use client'

import { useActionState, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { StoryStatus } from '@prisma/client'

import { createStoryAction, updateStoryAction } from '@/app/actions/stories'
import { EMPTY_STATE } from '@/lib/validation'
import { STORY_STATUS_LABELS, STORY_STATUS_ORDER, toDateInputValue } from '@/lib/format'
import { Dialog } from '@/components/ui/dialog'
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export type StoryValues = {
  id?: string
  title?: string
  asA?: string
  iWant?: string
  soThat?: string
  description?: string
  status?: StoryStatus
  startDate?: Date | null
  endDate?: Date | null
}

/// Formulario de historia de usuario. Crea si no trae id, edita si lo trae.
export function StoryDialog({
  trigger,
  projectId,
  story,
  unstyledTrigger,
  open: controlledOpen,
  onClose,
}: {
  trigger?: ReactNode
  projectId: string
  story?: StoryValues
  unstyledTrigger?: boolean
  open?: boolean
  onClose?: () => void
}) {
  const router = useRouter()
  const editing = Boolean(story?.id)
  const [internalOpen, setInternalOpen] = useState(false)
  const [state, formAction] = useActionState(
    editing ? updateStoryAction : createStoryAction,
    EMPTY_STATE,
  )

  // El diálogo puede abrirse por su propio botón o desde fuera (al pulsar una
  // barra del cronograma), así que acepta las dos formas.
  const controlado = controlledOpen !== undefined
  const abierto = controlado ? controlledOpen : internalOpen

  function cerrar() {
    if (controlado) onClose?.()
    else setInternalOpen(false)
  }

  useEffect(() => {
    if (!state.ok) return
    cerrar()
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <>
      {trigger && (
        <button
          type="button"
          onClick={() => setInternalOpen(true)}
          className={
            unstyledTrigger
              ? 'block w-full text-left'
              : 'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90'
          }
        >
          {!unstyledTrigger && <Plus className="size-4" />}
          {trigger}
        </button>
      )}

      <Dialog
        open={abierto}
        onClose={cerrar}
        size="lg"
        title={editing ? 'Editar historia' : 'Nueva historia de usuario'}
        description="Describe qué necesita el usuario y cuándo se va a hacer. Las tareas se enganchan luego."
      >
        <form action={formAction} className="flex flex-col gap-4">
          {story?.id && <input type="hidden" name="id" value={story.id} />}
          <input type="hidden" name="projectId" value={projectId} />

          <Field label="Título" htmlFor="story-title" error={state.errors?.title}>
            <Input
              id="story-title"
              name="title"
              required
              defaultValue={story?.title}
              placeholder="Reserva de puesto de parqueadero"
            />
          </Field>

          {/* La fórmula, en tres campos. Separarlos guía a quien escribe y evita
              el «como usuario quiero que funcione» que no dice nada. */}
          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              La historia
            </legend>
            <div className="flex flex-col gap-3">
              <Field label="Como…" htmlFor="story-asA" error={state.errors?.asA}>
                <Input
                  id="story-asA"
                  name="asA"
                  defaultValue={story?.asA}
                  placeholder="empleado con vehículo"
                />
              </Field>
              <Field label="quiero…" htmlFor="story-iWant" error={state.errors?.iWant}>
                <Input
                  id="story-iWant"
                  name="iWant"
                  defaultValue={story?.iWant}
                  placeholder="reservar un puesto con un día de antelación"
                />
              </Field>
              <Field label="para…" htmlFor="story-soThat" error={state.errors?.soThat}>
                <Input
                  id="story-soThat"
                  name="soThat"
                  defaultValue={story?.soThat}
                  placeholder="no dar vueltas buscando sitio al llegar"
                />
              </Field>
            </div>
          </fieldset>

          <Field
            label="Criterios de aceptación"
            htmlFor="story-description"
            hint="Cuándo se considera terminada. Opcional."
            error={state.errors?.description}
          >
            <Textarea
              id="story-description"
              name="description"
              defaultValue={story?.description}
              placeholder="- Solo se puede reservar de lunes a viernes&#10;- Máximo una reserva activa por persona"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Estado" htmlFor="story-status" error={state.errors?.status}>
              <Select id="story-status" name="status" defaultValue={story?.status ?? 'PLANNED'}>
                {STORY_STATUS_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {STORY_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Inicio" htmlFor="story-start" error={state.errors?.startDate}>
              <Input
                id="story-start"
                name="startDate"
                type="date"
                defaultValue={toDateInputValue(story?.startDate)}
              />
            </Field>
            <Field label="Fin" htmlFor="story-end" error={state.errors?.endDate}>
              <Input
                id="story-end"
                name="endDate"
                type="date"
                defaultValue={toDateInputValue(story?.endDate)}
              />
            </Field>
          </div>

          <p className="-mt-2 text-[11px] text-muted-foreground">
            Con las dos fechas la historia aparece en la línea de tiempo. Sin ellas queda en «sin
            programar».
          </p>


          {state.message && !state.ok && <FormMessage>{state.message}</FormMessage>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <SubmitButton pendingLabel="Guardando…">
              {editing ? 'Guardar cambios' : 'Crear historia'}
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  )
}
