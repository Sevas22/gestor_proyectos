import type { Metadata } from 'next'
import Link from 'next/link'
import { ListTodo } from 'lucide-react'
import { TaskStatus } from '@prisma/client'

import { requireViewer } from '@/lib/dal'
import { getOrgTasks, getProjectOptions } from '@/lib/queries'
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  TASK_STATUS_STYLES,
  formatShortDate,
  isOverdue,
  projectColor,
  plural,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shell/app-shell'
import { Avatar, Badge, Card, EmptyState } from '@/components/ui/primitives'
import { TaskFilters } from '@/components/tasks/task-filters'

export const metadata: Metadata = { title: 'Tareas' }

type Props = {
  searchParams: Promise<{ scope?: string; status?: string; project?: string }>
}

function parseStatus(value?: string): TaskStatus | undefined {
  return TASK_STATUS_ORDER.includes(value as TaskStatus) ? (value as TaskStatus) : undefined
}

export default async function TasksPage({ searchParams }: Props) {
  const filters = await searchParams
  const viewer = await requireViewer()

  // Por defecto se muestran las tareas de quien mira; "todas" es opt-in.
  const scope = filters.scope === 'all' ? 'all' : 'mine'
  const status = parseStatus(filters.status)
  const projectId = filters.project || undefined

  const [tasks, projects] = await Promise.all([
    getOrgTasks(viewer.orgId, {
      assigneeId: scope === 'mine' ? viewer.id : undefined,
      status,
      projectId,
    }),
    getProjectOptions(viewer.orgId),
  ])

  return (
    <div className="mx-auto max-w-[1400px] p-5 sm:p-8">
      <PageHeader
        eyebrow={
          <>
            <ListTodo className="size-3.5" />
            {scope === 'mine' ? 'Asignadas a ti' : 'Todo el equipo'}
          </>
        }
        title={scope === 'mine' ? 'Mis tareas' : 'Tareas del equipo'}
        description="Filtra por estado o proyecto para acotar la lista."
      />

      <TaskFilters projects={projects} scope={scope} status={status} projectId={projectId} />

      <Card className="mt-6 overflow-hidden">
        {tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="size-5" />}
            title="No hay tareas con estos filtros"
            description={
              scope === 'mine'
                ? 'No tienes tareas asignadas que cumplan los filtros. Prueba a ver las de todo el equipo.'
                : 'Ajusta los filtros o crea una tarea desde el tablero de un proyecto.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">
                Tareas {scope === 'mine' ? 'asignadas a ti' : 'del equipo'}
              </caption>
              <thead className="bg-accent/50 text-[10px] tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Tarea
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Proyecto
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Estado
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Prioridad
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Entrega
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Responsable
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((task) => {
                  const color = projectColor(task.project.colorSeed)
                  const late = isOverdue(task.dueDate) && task.status !== 'DONE'
                  return (
                    <tr key={task.id} className="transition-colors hover:bg-accent/40">
                      <td className="px-5 py-4">
                        <Link
                          href={`/projects/${task.projectId}?task=${task.id}`}
                          className="flex items-start gap-3"
                        >
                          <span
                            className={cn(
                              'mt-1.5 size-2 shrink-0 rounded-full',
                              TASK_STATUS_STYLES[task.status].dot,
                            )}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium">{task.title}</span>
                            <span className="tabular mt-0.5 block font-mono text-[10px] text-muted-foreground">
                              {task.project.key}-{task.number}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-4">
                        <Link
                          href={`/projects/${task.projectId}`}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <span className={cn('size-2 shrink-0 rounded-full', color.bg)} />
                          <span className="truncate">{task.project.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-4">
                        <Badge className={TASK_STATUS_STYLES[task.status].chip}>
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-4">
                        <Badge className={PRIORITY_STYLES[task.priority]}>
                          {PRIORITY_LABELS[task.priority]}
                        </Badge>
                      </td>
                      <td className="px-3 py-4">
                        {task.dueDate ? (
                          <span
                            className={cn(
                              'text-xs',
                              late ? 'font-semibold text-destructive' : 'text-muted-foreground',
                            )}
                          >
                            {formatShortDate(task.dueDate)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={task.assignee.name}
                              seed={task.assignee.avatarSeed}
                              size="sm"
                            />
                            <span className="truncate text-xs">{task.assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin asignar</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {tasks.length > 0 && (
        <p className="tabular mt-4 text-xs text-muted-foreground">
          {plural(tasks.length, 'tarea')}
          {tasks.length === 200 && ' (mostrando las primeras 200)'}
        </p>
      )}
    </div>
  )
}
