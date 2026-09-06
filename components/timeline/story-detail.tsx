'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, ListTodo, Pencil, Trash2 } from 'lucide-react'
import type { Priority, StoryStatus, TaskStatus } from '@prisma/client'

import { deleteStoryAction } from '@/app/actions/stories'
import { can, type Permission } from '@/lib/permissions'
import { EMPTY_STATE } from '@/lib/validation'
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  STORY_STATUS_LABELS,
  STORY_STATUS_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  daysBetween,
  formatDate,
  formatShortDate,
  isOverdue,
  plural,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Dialog } from '@/components/ui/dialog'
import { Avatar, Badge, Progress } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'
import { TimeAgo } from '@/components/ui/time-ago'
import { StoryDialog } from '@/components/timeline/story-dialog'
import { AssigneeStack } from '@/components/board/assignee-stack'

export type StoryDetailData = {
  id: string
  number: number
  title: string
  asA: string
  iWant: string
  soThat: string
  description: string
  status: StoryStatus
  startDate: Date | null
  endDate: Date | null
  projectId: string
  createdAt: Date
  createdBy: { id: string; name: string; avatarSeed: number }
  project: { id: string; key: string; name: string }
  tasks: {
    id: string
    number: number
    title: string
    status: TaskStatus
    priority: Priority
    dueDate: Date | null
    assignees: { id: string; name: string; avatarSeed: number }[]
  }[]
}

/// Detalle de una historia: la fórmula, las fechas y las tareas que cuelgan.
/// Se abre desde `?story=<id>`, así que cerrarlo es volver a la URL limpia.
export function StoryDetail({
  story,
  permissions,
}: {
  story: StoryDetailData
  permissions: Permission[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleteState, deleteAction] = useActionState(deleteStoryAction, EMPTY_STATE)

  const close = () => router.push(`/projects/${story.projectId}/cronograma`, { scroll: false })

  useEffect(() => {
    if (deleteState.ok) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteState])

  const canEdit = can(permissions, 'story:update')
  const canDelete = can(permissions, 'story:delete')

  const hechas = story.tasks.filter((t) => t.status === 'DONE').length
  const progreso = story.tasks.length === 0 ? 0 : Math.round((hechas / story.tasks.length) * 100)
  const estilo = STORY_STATUS_STYLES[story.status]

  return (
    <>
      <Dialog
        open={!editing}
        onClose={close}
        size="lg"
        title={story.title}
        description={`${story.project.key}-H${story.number} · ${story.project.name}`}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={estilo.chip}>{STORY_STATUS_LABELS[story.status]}</Badge>
            {story.startDate && story.endDate ? (
              <Badge className="bg-accent text-muted-foreground">
                <CalendarRange className="size-3" />
                {formatShortDate(story.startDate)} — {formatShortDate(story.endDate)} ·{' '}
                {plural(daysBetween(story.startDate, story.endDate), 'día')}
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Sin programar
              </Badge>
            )}
          </div>

          {(story.asA || story.iWant || story.soThat) && (
            <div className="rounded-lg bg-accent/50 p-4 text-sm leading-7">
              <span className="text-muted-foreground">Como </span>
              <span className="font-semibold">{story.asA || '…'}</span>
              <span className="text-muted-foreground">, quiero </span>
              <span className="font-semibold">{story.iWant || '…'}</span>
              <span className="text-muted-foreground">, para </span>
              <span className="font-semibold">{story.soThat || '…'}</span>
            </div>
          )}

          {story.description && (
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Criterios de aceptación
              </p>
              <p className="text-sm leading-6 whitespace-pre-wrap text-pretty">
                {story.description}
              </p>
            </div>
          )}

          <div className="border-t border-border pt-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <ListTodo className="size-3" />
                Tareas ({story.tasks.length})
              </p>
              {story.tasks.length > 0 && (
                <span className="tabular text-[11px] text-muted-foreground">
                  {hechas} de {story.tasks.length} · {progreso}%
                </span>
              )}
            </div>

            {story.tasks.length === 0 ? (
              <p className="rounded-lg bg-accent/50 px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
                Ninguna tarea cuelga de esta historia todavía. Al crear o editar una tarea puedes
                elegir a qué historia pertenece.
              </p>
            ) : (
              <>
                <Progress value={progreso} className="mb-3 h-1.5" />
                <ul className="flex flex-col gap-1.5">
                  {story.tasks.map((task) => {
                    const late = isOverdue(task.dueDate) && task.status !== 'DONE'
                    return (
                      <li key={task.id}>
                        <a
                          href={`/projects/${story.projectId}?task=${task.id}`}
                          className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 transition-colors hover:bg-accent/50"
                        >
                          <span
                            className={cn(
                              'size-2 shrink-0 rounded-full',
                              TASK_STATUS_STYLES[task.status].dot,
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">{task.title}</span>
                            <span className="tabular font-mono text-[10px] text-muted-foreground">
                              {story.project.key}-{task.number} ·{' '}
                              {TASK_STATUS_LABELS[task.status]}
                              {task.dueDate && (
                                <span className={cn('ml-1.5', late && 'font-bold text-destructive')}>
                                  {formatShortDate(task.dueDate)}
                                </span>
                              )}
                            </span>
                          </span>
                          <Badge className={cn('shrink-0', PRIORITY_STYLES[task.priority])}>
                            {PRIORITY_LABELS[task.priority]}
                          </Badge>
                          <AssigneeStack assignees={task.assignees} />
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Creada por {story.createdBy.name} <TimeAgo date={story.createdAt} />
            {story.startDate && ` · programada desde el ${formatDate(story.startDate)}`}
          </p>

          {(canEdit || canDelete) && (
            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-5">
              {canDelete ? (
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={story.id} />
                  <SubmitButton variant="destructive" pendingLabel="Eliminando…">
                    <Trash2 className="size-4" />
                    Eliminar
                  </SubmitButton>
                </form>
              ) : (
                <span />
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

          {story.tasks.length > 0 && canDelete && (
            <p className="-mt-3 text-[11px] text-muted-foreground">
              Al eliminarla, sus {plural(story.tasks.length, 'tarea seguirá', 'tareas seguirán')} en
              el tablero, sin historia.
            </p>
          )}
        </div>
      </Dialog>

      <StoryDialog
        projectId={story.projectId}
        open={editing}
        onClose={() => setEditing(false)}
        story={{
          id: story.id,
          title: story.title,
          asA: story.asA,
          iWant: story.iWant,
          soThat: story.soThat,
          description: story.description,
          status: story.status,
          startDate: story.startDate,
          endDate: story.endDate,
        }}
      />
    </>
  )
}
