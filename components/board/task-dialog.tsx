'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Priority, TaskStatus } from '@prisma/client'

import { createTaskAction, updateTaskAction } from '@/app/actions/tasks'
import { EMPTY_STATE } from '@/lib/validation'
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  toDateInputValue,
} from '@/lib/format'
import { Dialog } from '@/components/ui/dialog'
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export type TaskFormValues = {
  id?: string
  title?: string
  description?: string
  projectId: string
  status: TaskStatus
  priority?: Priority
  assigneeId?: string | null
  dueDate?: Date | null
}

/// Formulario de tarea. Crea si `values.id` viene vacío, edita si trae id.
export function TaskDialog({
  open,
  onClose,
  members,
  projects,
  values,
}: {
  open: boolean
  onClose: () => void
  members: { id: string; name: string; avatarSeed: number }[]
  projects: { id: string; name: string; key: string }[]
  values?: TaskFormValues
}) {
  const router = useRouter()
  const editing = Boolean(values?.id)
  const [state, formAction] = useActionState(editing ? updateTaskAction : createTaskAction, EMPTY_STATE)

  useEffect(() => {
    if (!state.ok) return
    onClose()
    // La server action ya revalidó las rutas; refresh vuelve a pedir el árbol
    // del servidor para que el tablero muestre la tarjeta nueva sin recargar.
    router.refresh()
    // Solo debe dispararse cuando cambia el resultado de la acción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  if (!values) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Editar tarea' : 'Nueva tarea'}
      description={
        editing
          ? 'Los cambios quedan registrados en la actividad del equipo.'
          : 'Describe qué hay que hacer y quién se encarga.'
      }
    >
      {/* key remonta el formulario cuando cambian los valores iniciales, para que
          los defaultValue de los campos se apliquen de nuevo. */}
      <form
        key={values.id ?? `new-${values.status}`}
        action={formAction}
        className="flex flex-col gap-4"
      >
        {values.id && <input type="hidden" name="id" value={values.id} />}

        <Field label="Título" htmlFor="title" error={state.errors?.title}>
          <Input
            id="title"
            name="title"
            required
            defaultValue={values.title}
            placeholder="Validar permisos por rol"
          />
        </Field>

        <Field label="Descripción" htmlFor="description" error={state.errors?.description}>
          <Textarea
            id="description"
            name="description"
            defaultValue={values.description}
            placeholder="Contexto, criterios de aceptación, enlaces…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Proyecto" htmlFor="projectId" error={state.errors?.projectId}>
            <Select id="projectId" name="projectId" defaultValue={values.projectId} required>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.key} · {project.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Responsable" htmlFor="assigneeId" error={state.errors?.assigneeId}>
            <Select id="assigneeId" name="assigneeId" defaultValue={values.assigneeId ?? ''}>
              <option value="">Sin asignar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Estado" htmlFor="status" error={state.errors?.status}>
            <Select id="status" name="status" defaultValue={values.status}>
              {TASK_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prioridad" htmlFor="priority" error={state.errors?.priority}>
            <Select id="priority" name="priority" defaultValue={values.priority ?? 'MEDIUM'}>
              {PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Fecha límite" htmlFor="dueDate" hint="Opcional" error={state.errors?.dueDate}>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={toDateInputValue(values.dueDate)}
          />
        </Field>

        {state.message && !state.ok && <FormMessage>{state.message}</FormMessage>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancelar
          </button>
          <SubmitButton pendingLabel="Guardando…">
            {editing ? 'Guardar cambios' : 'Crear tarea'}
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  )
}
