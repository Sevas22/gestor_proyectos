'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Priority, TaskStatus } from '@prisma/client'

import { createTaskAction, updateTaskAction } from '@/app/actions/tasks'
import { uploadAttachmentAction } from '@/app/actions/attachments'
import { EMPTY_STATE } from '@/lib/validation'
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  TASK_STATUS_LABELS,
  ALL_TASK_STATUSES,
  toDateInputValue,
} from '@/lib/format'
import { Dialog } from '@/components/ui/dialog'
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/primitives'
import { AssigneePicker } from '@/components/board/assignee-picker'
import { FilePicker } from '@/components/board/file-picker'
import { SubmitButton } from '@/components/ui/submit-button'

export type TaskFormValues = {
  id?: string
  title?: string
  description?: string
  projectId: string
  status: TaskStatus
  priority?: Priority
  assigneeIds?: string[]
  storyId?: string | null
  dueDate?: Date | null
}

/// Formulario de tarea. Crea si `values.id` viene vacío, edita si trae id.
export function TaskDialog({
  open,
  onClose,
  members,
  projects,
  stories = [],
  values,
}: {
  open: boolean
  onClose: () => void
  members: { id: string; name: string; avatarSeed: number }[]
  projects: { id: string; name: string; key: string }[]
  stories?: { id: string; number: number; title: string; project: { key: string } }[]
  values?: TaskFormValues
}) {
  const router = useRouter()
  const editing = Boolean(values?.id)
  const [state, formAction] = useActionState(editing ? updateTaskAction : createTaskAction, EMPTY_STATE)

  // Archivos elegidos antes de que la tarea exista. Esperan aquí hasta que el
  // servidor devuelve el id.
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!state.ok) return

    // Sin archivos pendientes, el comportamiento de siempre.
    if (!state.createdId || pendingFiles.length === 0) {
      onClose()
      setPendingFiles([])
      router.refresh()
      return
    }

    // Cada archivo va en su propia petición. Mandarlos juntos sumaría tamaños y
    // chocaría contra el límite de 4,5 MB por cuerpo que impone la plataforma.
    let cancelado = false
    setUploading(true)
    ;(async () => {
      const fallidos: string[] = []
      for (const file of pendingFiles) {
        const fd = new FormData()
        fd.append('taskId', state.createdId!)
        fd.append('file', file)
        const resultado = await uploadAttachmentAction(EMPTY_STATE, fd)
        if (!resultado.ok) fallidos.push(file.name)
      }
      if (cancelado) return

      setUploading(false)
      setPendingFiles([])

      // La tarea ya se creó: un fallo al adjuntar no debe hacer creer que se
      // perdió todo. Se deja el diálogo abierto con el aviso.
      if (fallidos.length > 0) {
        setUploadError(
          `La tarea se creó, pero no se pudieron adjuntar: ${fallidos.join(', ')}. Puedes intentarlo desde el detalle de la tarea.`,
        )
        router.refresh()
        return
      }

      onClose()
      router.refresh()
    })()

    return () => {
      cancelado = true
    }
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

        <Field label="Responsables" htmlFor="assignees" error={state.errors?.assigneeIds}>
          <AssigneePicker members={members} defaultSelected={values.assigneeIds ?? []} />
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

          <Field label="Estado" htmlFor="status" error={state.errors?.status}>
            <Select id="status" name="status" defaultValue={values.status}>
              {ALL_TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Historia de usuario"
            htmlFor="storyId"
            hint={stories.length === 0 ? 'Aún no hay historias en este proyecto.' : 'Opcional'}
            error={state.errors?.storyId}
          >
            <Select
              id="storyId"
              name="storyId"
              defaultValue={values.storyId ?? ''}
              disabled={stories.length === 0}
            >
              <option value="">Sin historia</option>
              {stories.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.project.key}-H{story.number} · {story.title}
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

        {!editing && (
          <Field label="Archivos" htmlFor="files" hint="Opcional">
            <FilePicker files={pendingFiles} onChange={setPendingFiles} disabled={uploading} />
          </Field>
        )}

        <Field label="Fecha límite" htmlFor="dueDate" hint="Opcional" error={state.errors?.dueDate}>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={toDateInputValue(values.dueDate)}
          />
        </Field>

        {state.message && !state.ok && <FormMessage>{state.message}</FormMessage>}
        {uploadError && <FormMessage>{uploadError}</FormMessage>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            Cancelar
          </button>
          <SubmitButton pendingLabel={uploading ? 'Subiendo archivos…' : 'Guardando…'}>
            {editing ? 'Guardar cambios' : 'Crear tarea'}
          </SubmitButton>
        </div>
      </form>
    </Dialog>
  )
}
