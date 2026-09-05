'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Layers, Pencil, Send, Trash2, User2 } from 'lucide-react'
import type { Priority, TaskStatus } from '@prisma/client'

import { createCommentAction } from '@/app/actions/comments'
import { deleteTaskAction, sendToBacklogAction } from '@/app/actions/tasks'
import { can, type Permission } from '@/lib/permissions'
import { EMPTY_STATE } from '@/lib/validation'
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  formatDate,
  isOverdue,
  relativeTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Dialog } from '@/components/ui/dialog'
import { Avatar, Badge, FormMessage, Input } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'
import { TaskDialog, type TaskFormValues } from '@/components/board/task-dialog'

export type TaskDetailData = {
  id: string
  number: number
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  dueDate: Date | null
  createdAt: Date
  projectId: string
  assigneeId: string | null
  project: { id: string; key: string; name: string }
  assignee: { id: string; name: string; avatarSeed: number } | null
  createdBy: { id: string; name: string; avatarSeed: number }
  comments: {
    id: string
    body: string
    createdAt: Date
    authorId: string
    author: { id: string; name: string; avatarSeed: number }
  }[]
}

/// Panel de detalle. Se abre desde `?task=<id>`, así que cerrarlo es simplemente
/// volver a la URL del proyecto.
export function TaskDetail({
  task,
  permissions,
  viewerId,
  members,
  projects,
}: {
  task: TaskDetailData
  permissions: Permission[]
  viewerId: string
  members: { id: string; name: string; avatarSeed: number }[]
  projects: { id: string; name: string; key: string }[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [commentState, commentAction] = useActionState(createCommentAction, EMPTY_STATE)
  const [deleteState, deleteAction] = useActionState(deleteTaskAction, EMPTY_STATE)
  const [backlogState, backlogAction] = useActionState(sendToBacklogAction, EMPTY_STATE)
  const formRef = useRef<HTMLFormElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const close = () => router.push(`/projects/${task.projectId}`, { scroll: false })

  // Vacía el campo y baja al comentario recién publicado.
  useEffect(() => {
    if (!commentState.ok) return
    formRef.current?.reset()
    router.refresh()
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentState])

  useEffect(() => {
    if (deleteState.ok) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteState])

  // Al mandarla al backlog ya no pertenece a esta vista: se cierra el panel y se
  // vuelve a pedir el árbol para que el tablero deje de mostrarla.
  useEffect(() => {
    if (!backlogState.ok) return
    close()
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backlogState])

  const editValues: TaskFormValues = {
    id: task.id,
    title: task.title,
    description: task.description,
    projectId: task.projectId,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
  }

  const canEdit = can(permissions, 'task:update')
  const canDelete = can(permissions, 'task:delete')
  const canMove = can(permissions, 'task:move')
  const canComment = can(permissions, 'comment:create')
  const late = isOverdue(task.dueDate) && task.status !== 'DONE'

  return (
    <>
      <Dialog
        open={!editing}
        onClose={close}
        size="lg"
        title={task.title}
        description={`${task.project.key}-${task.number} · ${task.project.name}`}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={TASK_STATUS_STYLES[task.status].chip}>
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
            <Badge className={PRIORITY_STYLES[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
            {task.dueDate && (
              <Badge
                className={cn(
                  late
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-accent text-muted-foreground',
                )}
              >
                <CalendarDays className="size-3" />
                {formatDate(task.dueDate)}
              </Badge>
            )}
          </div>

          <div className="grid gap-4 rounded-lg bg-accent/50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Responsable
              </p>
              {task.assignee ? (
                <div className="mt-2 flex items-center gap-2">
                  <Avatar name={task.assignee.name} seed={task.assignee.avatarSeed} size="sm" />
                  <span className="text-sm font-medium">{task.assignee.name}</span>
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <User2 className="size-4" />
                  Sin asignar
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Creada por
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Avatar name={task.createdBy.name} seed={task.createdBy.avatarSeed} size="sm" />
                <span className="text-sm">
                  {task.createdBy.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {relativeTime(task.createdAt)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Descripción
            </p>
            <p className="text-sm leading-6 whitespace-pre-wrap text-pretty">
              {task.description || (
                <span className="text-muted-foreground">Esta tarea no tiene descripción.</span>
              )}
            </p>
          </div>

          <div className="border-t border-border pt-5">
            <p className="mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Comentarios ({task.comments.length})
            </p>

            {task.comments.length === 0 ? (
              <p className="rounded-lg bg-accent/50 px-3 py-4 text-center text-xs text-muted-foreground">
                Todavía nadie ha comentado.
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
                {task.comments.map((comment) => (
                  <li key={comment.id} className="flex gap-3">
                    <Avatar name={comment.author.name} seed={comment.author.avatarSeed} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold">
                          {comment.authorId === viewerId ? 'Tú' : comment.author.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {relativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm leading-5 whitespace-pre-wrap text-pretty">
                        {comment.body}
                      </p>
                    </div>
                  </li>
                ))}
                <div ref={commentsEndRef} />
              </ul>
            )}

            {canComment && (
              <form ref={formRef} action={commentAction} className="mt-3 flex gap-2">
                <input type="hidden" name="taskId" value={task.id} />
                <Input
                  name="body"
                  required
                  maxLength={2000}
                  placeholder="Escribe un comentario…"
                  className="flex-1"
                  aria-label="Nuevo comentario"
                />
                <SubmitButton className="px-3" aria-label="Publicar comentario">
                  <Send className="size-4" />
                </SubmitButton>
              </form>
            )}
            {commentState.message && !commentState.ok && (
              <div className="mt-2">
                <FormMessage>{commentState.message}</FormMessage>
              </div>
            )}
          </div>

          {(canEdit || canDelete || canMove) && (
            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-5">
              {canDelete ? (
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={task.id} />
                  <SubmitButton variant="destructive" pendingLabel="Eliminando…">
                    <Trash2 className="size-4" />
                    Eliminar
                  </SubmitButton>
                </form>
              ) : (
                <span />
              )}

              {/* El camino de vuelta del backlog. Si algo se planificó antes de
                  tiempo, sacarlo del tablero no debería obligar a borrarlo. */}
              {canMove && task.status !== 'BACKLOG' && (
                <form action={backlogAction} className="ml-auto">
                  <input type="hidden" name="id" value={task.id} />
                  <SubmitButton variant="outline" pendingLabel="Moviendo…">
                    <Layers className="size-4" />
                    Al backlog
                  </SubmitButton>
                </form>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Pencil className="size-4" />
                  Editar
                </button>
              )}
            </div>
          )}

          {deleteState.message && !deleteState.ok && <FormMessage>{deleteState.message}</FormMessage>}
          {backlogState.message && !backlogState.ok && (
            <FormMessage>{backlogState.message}</FormMessage>
          )}
        </div>
      </Dialog>

      <TaskDialog
        open={editing}
        onClose={() => setEditing(false)}
        members={members}
        projects={projects}
        values={editValues}
      />
    </>
  )
}
