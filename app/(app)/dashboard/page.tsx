import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FolderKanban,
  ListTodo,
  Sparkles,
  Users,
} from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import { getActivity, getDashboardStats, getOrgTasks, getProjects, getWorkload } from '@/lib/queries'
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  TASK_STATUS_STYLES,
  greeting,
  formatLongDate,
  projectColor,
  relativeTime,
  isOverdue,
  formatShortDate,
  plural,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shell/app-shell'
import { Avatar, Badge, Card, CardHeader, EmptyState, Progress } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Resumen' }

export default async function DashboardPage() {
  const viewer = await requireViewer()
  const [stats, projects, activity, workload, myTasks] = await Promise.all([
    getDashboardStats(viewer.orgId, viewer.id),
    getProjects(viewer.orgId),
    getActivity(viewer.orgId, 8),
    getWorkload(viewer.orgId),
    getOrgTasks(viewer.orgId, { assigneeId: viewer.id }),
  ])

  // Sin backlog: la cifra de «Asignadas a ti» ya lo excluye, y la lista debe
  // contar lo mismo que el número que tiene encima.
  const myOpenTasks = myTasks
    .filter((task) => task.status !== 'DONE' && task.status !== 'BACKLOG')
    .slice(0, 5)
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').slice(0, 4)

  const metrics = [
    {
      label: 'Tareas abiertas',
      value: stats.open,
      detail: `${stats.total} en total`,
      icon: ListTodo,
      tone: 'text-chart-1',
    },
    {
      label: 'Asignadas a ti',
      value: stats.mine,
      detail: stats.mine === 0 ? 'Nada pendiente' : 'Requieren tu atención',
      icon: CheckCircle2,
      tone: 'text-chart-3',
    },
    {
      label: 'Fuera de plazo',
      value: stats.overdue,
      detail: stats.overdue === 0 ? 'Todo al día' : 'Pasaron su fecha límite',
      icon: AlertTriangle,
      tone: stats.overdue > 0 ? 'text-destructive' : 'text-chart-3',
    },
    {
      label: 'Cerradas esta semana',
      value: stats.completedThisWeek,
      detail: plural(stats.projectCount, 'proyecto activo', 'proyectos activos'),
      icon: Sparkles,
      tone: 'text-chart-4',
    },
  ]

  return (
    <div className="mx-auto max-w-[1400px] p-5 sm:p-8">
      <PageHeader
        eyebrow={
          <>
            <Sparkles className="size-3.5" />
            {formatLongDate(new Date())}
          </>
        }
        title={`${greeting()}, ${viewer.name.split(' ')[0]}`}
        description="Lo que está en movimiento en tu equipo y lo que necesita atención hoy."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <Card key={label} className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={cn('size-4', tone)} />
            </div>
            <div className="flex items-end justify-between gap-3">
              <p className="tabular text-3xl font-bold tracking-tight">{value}</p>
              <span className="pb-1 text-right text-[11px] leading-4 text-muted-foreground">
                {detail}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader
            title="Progreso general"
            subtitle={`${stats.done} de ${stats.total} tareas completadas`}
            action={
              <Link
                href="/tasks"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Ver todas <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          <div className="p-5">
            {stats.total === 0 ? (
              <EmptyState
                icon={<ListTodo className="size-5" />}
                title="Todavía no hay tareas"
                description="Crea un proyecto y añade la primera tarea para empezar a ver el progreso del equipo aquí."
                action={
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    <FolderKanban className="size-4" />
                    Ir a proyectos
                  </Link>
                }
              />
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-5">
                  <div
                    className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(var(--primary) 0 ${stats.progress}%, var(--muted) ${stats.progress}% 100%)`,
                    }}
                  >
                    <div className="tabular flex size-[76px] items-center justify-center rounded-full bg-card text-lg font-bold">
                      {stats.progress}%
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {stats.progress >= 70
                        ? 'Buen ritmo esta semana'
                        : stats.progress >= 35
                          ? 'Avance constante'
                          : 'El trabajo acaba de empezar'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {stats.inProgress} en progreso · {stats.inReview} en revisión
                      <br />
                      {plural(stats.memberCount, 'persona')} en el equipo
                      {stats.backlog > 0 && (
                        <>
                          <br />
                          <span className="text-violet-600 dark:text-violet-400">
                            {plural(stats.backlog, 'elemento')} en backlog, sin comprometer
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Solo las columnas del tablero: el backlog no es trabajo
                    comprometido y tiene su propia cifra más abajo. */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {TASK_STATUS_ORDER.map((status) => {
                    const value: number = {
                      TODO: stats.todo,
                      IN_PROGRESS: stats.inProgress,
                      IN_REVIEW: stats.inReview,
                      DONE: stats.done,
                    }[status]
                    return (
                      <div key={status} className="rounded-lg bg-accent p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn('size-1.5 rounded-full', TASK_STATUS_STYLES[status].dot)}
                          />
                          <p className="tabular text-lg font-bold">{value}</p>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {TASK_STATUS_LABELS[status]}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Actividad reciente"
            subtitle="Últimos movimientos del equipo"
            action={<ActivityIcon className="size-4 text-muted-foreground" />}
          />
          {activity.length === 0 ? (
            <EmptyState
              title="Sin actividad todavía"
              description="Aquí aparecerá cada cambio: tareas creadas, movidas, comentadas o asignadas."
            />
          ) : (
            <ul className="flex flex-col gap-4 p-5">
              {activity.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <Avatar name={item.actor.name} seed={item.actor.avatarSeed} size="sm" />
                  <div className="min-w-0 text-xs leading-5">
                    <p>
                      <span className="font-semibold">{item.actor.name.split(' ')[0]}</span>{' '}
                      <span className="text-muted-foreground">{item.summary}</span>
                    </p>
                    <p className="text-muted-foreground">{relativeTime(item.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader
            title="Tus tareas"
            subtitle={
              stats.mine === 0 ? 'No tienes nada asignado' : `${plural(stats.mine, 'tarea pendiente', 'tareas pendientes')} de tu parte`
            }
            action={
              <Link
                href="/tasks"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Ver todas <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          {myOpenTasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-5" />}
              title="Bandeja limpia"
              description="No tienes tareas abiertas asignadas. Cuando alguien te asigne una, aparecerá aquí."
            />
          ) : (
            <ul className="divide-y divide-border">
              {myOpenTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/projects/${task.projectId}?task=${task.id}`}
                    className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-accent/50"
                  >
                    <span
                      className={cn('mt-1.5 size-2 shrink-0 rounded-full', TASK_STATUS_STYLES[task.status].dot)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="tabular mt-1 font-mono text-[10px] text-muted-foreground">
                        {task.project.key}-{task.number} · {task.project.name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {task.dueDate && (
                        <span
                          className={cn(
                            'text-[11px]',
                            isOverdue(task.dueDate)
                              ? 'font-semibold text-destructive'
                              : 'text-muted-foreground',
                          )}
                        >
                          {formatShortDate(task.dueDate)}
                        </span>
                      )}
                      <Badge className={PRIORITY_STYLES[task.priority]}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Carga del equipo"
            subtitle="Tareas abiertas por persona"
            action={<Users className="size-4 text-muted-foreground" />}
          />
          <div className="flex flex-col gap-4 p-5">
            {workload.slice(0, 6).map((person) => {
              const max = Math.max(...workload.map((p) => p.open), 1)
              return (
                <div key={person.id} className="flex items-center gap-3">
                  <Avatar name={person.name} seed={person.avatarSeed} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-medium">{person.name}</p>
                      <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                        {person.open}
                      </span>
                    </div>
                    <Progress value={(person.open / max) * 100} className="mt-1.5 h-1.5" />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {activeProjects.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Proyectos activos"
            subtitle={`${stats.projectCount} en marcha`}
            action={
              <Link
                href="/projects"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Ver todos <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
            {activeProjects.map((project) => {
              const color = projectColor(project.colorSeed)
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="bg-card p-5 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('size-2.5 rounded-full', color.bg)} />
                    <span className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground">
                      {project.key}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-semibold">{project.name}</p>
                  <p className="tabular mt-1 text-xs text-muted-foreground">
                    {project.doneCount}/{project.taskCount} tareas
                  </p>
                  <Progress value={project.progress} className="mt-3 h-1.5" />
                </Link>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
