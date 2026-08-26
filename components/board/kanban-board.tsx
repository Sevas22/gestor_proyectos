'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { MessageSquareText, Plus } from 'lucide-react'
import type { Priority, TaskStatus } from '@prisma/client'

import { moveTaskAction } from '@/app/actions/tasks'
import { can, type Permission } from '@/lib/permissions'
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  TASK_STATUS_STYLES,
  formatShortDate,
  isOverdue,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, Badge } from '@/components/ui/primitives'

export type BoardTask = {
  id: string
  number: number
  title: string
  status: TaskStatus
  priority: Priority
  position: number
  dueDate: Date | null
  assignee: { id: string; name: string; avatarSeed: number } | null
  project: { key: string }
  _count: { comments: number }
}

/// Tablero Kanban con arrastrar y soltar nativo del navegador (HTML5 drag and
/// drop). Se hace así en vez de con una librería porque el tablero solo necesita
/// mover tarjetas entre cuatro columnas, y una dependencia más sería peso muerto.
///
/// El movimiento se pinta de inmediato con useOptimistic y luego se confirma
/// contra el servidor. Si la acción falla, React descarta el estado optimista y
/// la tarjeta vuelve sola a su sitio.
export function KanbanBoard({
  tasks,
  permissions,
  onOpenTask,
  onCreateTask,
}: {
  tasks: BoardTask[]
  permissions: Permission[]
  onOpenTask: (taskId: string) => void
  onCreateTask: (status: TaskStatus) => void
}) {
  const [, startTransition] = useTransition()
  const [optimisticTasks, applyMove] = useOptimistic(
    tasks,
    (current: BoardTask[], move: { taskId: string; status: TaskStatus; beforeTaskId?: string | null }) =>
      current.map((task) =>
        task.id === move.taskId
          ? {
              ...task,
              status: move.status,
              // Posición provisional: solo tiene que ordenar bien hasta que
              // llegue la respuesta del servidor con el valor definitivo.
              position: move.beforeTaskId
                ? (current.find((t) => t.id === move.beforeTaskId)?.position ?? 0) - 0.5
                : Math.max(0, ...current.filter((t) => t.status === move.status).map((t) => t.position)) + 1,
            }
          : task,
      ),
  )

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null)

  const canMove = can(permissions, 'task:move')
  const canCreate = can(permissions, 'task:create')

  function move(taskId: string, status: TaskStatus, beforeTaskId?: string | null) {
    const task = optimisticTasks.find((t) => t.id === taskId)
    if (!task) return
    // Soltar una tarjeta donde ya estaba no debería costar una escritura.
    if (task.status === status && !beforeTaskId) return

    startTransition(async () => {
      applyMove({ taskId, status, beforeTaskId })
      try {
        await moveTaskAction(taskId, status, beforeTaskId ?? null)
      } catch (error) {
        console.error('No se pudo mover la tarea', error)
      }
    })
  }

  function handleDrop(status: TaskStatus, beforeTaskId?: string | null) {
    setOverColumn(null)
    const taskId = draggingId
    setDraggingId(null)
    if (taskId) move(taskId, status, beforeTaskId)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {TASK_STATUS_ORDER.map((status) => {
        const columnTasks = optimisticTasks
          .filter((task) => task.status === status)
          .sort((a, b) => a.position - b.position)
        const styles = TASK_STATUS_STYLES[status]

        return (
          <section
            key={status}
            aria-label={TASK_STATUS_LABELS[status]}
            onDragOver={(event) => {
              if (!canMove || !draggingId) return
              event.preventDefault()
              setOverColumn(status)
            }}
            onDragLeave={(event) => {
              // Solo se apaga si el puntero sale de la columna entera, no al
              // pasar de una tarjeta a otra dentro de ella.
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setOverColumn(null)
            }}
            onDrop={(event) => {
              event.preventDefault()
              handleDrop(status, null)
            }}
            className={cn(
              'flex min-h-[24rem] flex-col rounded-xl border border-border bg-muted/40 transition-colors',
              overColumn === status && draggingId && 'kanban-over',
            )}
          >
            <header className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={cn('size-2 rounded-full', styles.dot)} />
                <h3 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h3>
                <span className="tabular rounded-full bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {columnTasks.length}
                </span>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => onCreateTask(status)}
                  aria-label={`Nueva tarea en ${TASK_STATUS_LABELS[status]}`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </header>

            <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {columnTasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                  {canMove ? 'Arrastra una tarjeta aquí' : 'Sin tareas'}
                </p>
              )}

              {columnTasks.map((task) => {
                const late = isOverdue(task.dueDate) && task.status !== 'DONE'
                return (
                  <article
                    key={task.id}
                    draggable={canMove}
                    onDragStart={(event) => {
                      setDraggingId(task.id)
                      event.dataTransfer.effectAllowed = 'move'
                      // Firefox no inicia el arrastre sin datos en el portapapeles.
                      event.dataTransfer.setData('text/plain', task.id)
                    }}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverColumn(null)
                    }}
                    onDragOver={(event) => {
                      if (!canMove || !draggingId) return
                      event.preventDefault()
                      event.stopPropagation()
                      setOverColumn(status)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      handleDrop(status, task.id)
                    }}
                    className={cn(
                      'group rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md',
                      canMove && 'cursor-grab active:cursor-grabbing',
                      draggingId === task.id && 'kanban-dragging',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenTask(task.id)}
                      className="w-full text-left outline-none"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm leading-5 font-medium text-pretty">{task.title}</p>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="tabular font-mono text-[10px] text-muted-foreground">
                          {task.project.key}-{task.number}
                        </span>
                        <Badge className={PRIORITY_STYLES[task.priority]}>
                          {PRIORITY_LABELS[task.priority]}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {task._count.comments > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquareText className="size-3" />
                              {task._count.comments}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className={cn(late && 'font-semibold text-destructive')}>
                              {formatShortDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                        {task.assignee ? (
                          <Avatar
                            name={task.assignee.name}
                            seed={task.assignee.avatarSeed}
                            size="sm"
                          />
                        ) : (
                          <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-border text-[9px] text-muted-foreground">
                            ?
                          </span>
                        )}
                      </div>
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
