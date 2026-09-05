'use client'

import { useActionState, useEffect, useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, GripVertical, MessageSquareText, Plus } from 'lucide-react'

import { moveTaskAction, promoteFromBacklogAction } from '@/app/actions/tasks'
import { can, type Permission } from '@/lib/permissions'
import { EMPTY_STATE } from '@/lib/validation'
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  formatShortDate,
  isOverdue,
  plural,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, Badge, Card, EmptyState, FormMessage } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'
import type { BoardTask } from '@/components/board/kanban-board'

/// El backlog como lista ordenada, no como columna.
///
/// Se arrastra para priorizar —lo de arriba es lo siguiente que se hará— y cada
/// elemento tiene un botón para pasarlo al tablero. Reutiliza moveTaskAction
/// para el reordenamiento: la posición es el mismo campo que usa el Kanban,
/// solo que acotado al estado BACKLOG.
export function BacklogList({
  tasks,
  permissions,
  onOpenTask,
  onCreateTask,
}: {
  tasks: BoardTask[]
  permissions: Permission[]
  onOpenTask: (taskId: string) => void
  onCreateTask: () => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [optimistic, applyMove] = useOptimistic(
    tasks,
    (current: BoardTask[], move: { taskId: string; beforeTaskId: string | null }) => {
      const moving = current.find((t) => t.id === move.taskId)
      if (!moving) return current
      const rest = current.filter((t) => t.id !== move.taskId)
      const index = move.beforeTaskId ? rest.findIndex((t) => t.id === move.beforeTaskId) : -1
      if (index === -1) return [...rest, moving]
      return [...rest.slice(0, index), moving, ...rest.slice(index)]
    },
  )

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const canMove = can(permissions, 'task:move')
  const canCreate = can(permissions, 'task:create')

  function reorder(taskId: string, beforeTaskId: string | null) {
    startTransition(async () => {
      applyMove({ taskId, beforeTaskId })
      try {
        await moveTaskAction(taskId, 'BACKLOG', beforeTaskId)
      } catch (error) {
        console.error('No se pudo reordenar el backlog', error)
      }
    })
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Plus className="size-5" />}
          title="El backlog está vacío"
          description={
            canCreate
              ? 'Aquí va lo que el equipo aún no se ha comprometido a hacer. Cuando llegue su momento, lo pasas al tablero.'
              : 'Aquí aparecerá lo que el equipo tenga pendiente de priorizar.'
          }
          action={
            canCreate ? (
              <button
                type="button"
                onClick={onCreateTask}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="size-4" />
                Añadir al backlog
              </button>
            ) : undefined
          }
        />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="font-semibold">Por priorizar</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {plural(tasks.length, 'elemento')}
            {canMove && ' · arrastra para cambiar el orden'}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={onCreateTask}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Añadir
          </button>
        )}
      </div>

      <ol
        onDragOver={(event) => {
          if (canMove && draggingId) event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          const id = draggingId
          setDraggingId(null)
          setOverId(null)
          // Soltar fuera de cualquier fila lo manda al final de la lista.
          if (id) reorder(id, null)
        }}
        className="divide-y divide-border"
      >
        {optimistic.map((task, index) => {
          const late = isOverdue(task.dueDate)
          return (
            <li
              key={task.id}
              draggable={canMove}
              onDragStart={(event) => {
                setDraggingId(task.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', task.id)
              }}
              onDragEnd={() => {
                setDraggingId(null)
                setOverId(null)
              }}
              onDragOver={(event) => {
                if (!canMove || !draggingId) return
                event.preventDefault()
                event.stopPropagation()
                setOverId(task.id)
              }}
              onDrop={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const id = draggingId
                setDraggingId(null)
                setOverId(null)
                if (id && id !== task.id) reorder(id, task.id)
              }}
              className={cn(
                'flex items-center gap-3 px-5 py-3 transition-colors',
                canMove && 'cursor-grab active:cursor-grabbing',
                draggingId === task.id && 'opacity-40',
                overId === task.id && draggingId && 'border-t-2 border-t-primary bg-accent/50',
              )}
            >
              {canMove ? (
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <span className="tabular w-4 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
              )}

              <button
                type="button"
                onClick={() => onOpenTask(task.id)}
                className="min-w-0 flex-1 text-left outline-none"
              >
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="tabular mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  {task.project.key}-{task.number}
                  {task._count.comments > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquareText className="size-2.5" />
                      {task._count.comments}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className={cn(late && 'font-semibold text-destructive')}>
                      {formatShortDate(task.dueDate)}
                    </span>
                  )}
                </p>
              </button>

              <Badge className={cn('shrink-0', PRIORITY_STYLES[task.priority])}>
                {PRIORITY_LABELS[task.priority]}
              </Badge>

              {task.assignee ? (
                <Avatar name={task.assignee.name} seed={task.assignee.avatarSeed} size="sm" />
              ) : (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[9px] text-muted-foreground">
                  ?
                </span>
              )}

              {canMove && <PromoteButton taskId={task.id} onDone={() => router.refresh()} />}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

/// Botón de «al tablero». Lleva su propio estado de acción para que un fallo se
/// muestre junto al elemento que lo provocó y no en una franja global.
function PromoteButton({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const [state, formAction] = useActionState(promoteFromBacklogAction, EMPTY_STATE)

  // El refresco va en un efecto y no en el cuerpo del render: llamar a
  // router.refresh() mientras React renderiza provoca un aviso y, en el peor
  // caso, un bucle de renderizados.
  useEffect(() => {
    if (state.ok) onDone()
    // Solo cuando cambia el resultado de la acción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="id" value={taskId} />
      <SubmitButton
        variant="outline"
        className="px-2.5 py-1.5 text-xs"
        pendingLabel="…"
        title="Mover al tablero"
      >
        <ArrowUp className="size-3.5" />
        Al tablero
      </SubmitButton>
      {state.message && !state.ok && (
        <div className="mt-1">
          <FormMessage>{state.message}</FormMessage>
        </div>
      )}
    </form>
  )
}
