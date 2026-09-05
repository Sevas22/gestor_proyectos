import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Users } from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import { can } from '@/lib/permissions'
import {
  getOrgMembers,
  getProject,
  getProjectBacklog,
  getProjectOptions,
  getProjectTasks,
  getTaskDetail,
} from '@/lib/queries'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
  formatDate,
  isOverdue,
  projectColor,
  plural,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge, Progress } from '@/components/ui/primitives'
import { ProjectBoard } from '@/components/board/project-board'
import { ProjectTabs } from '@/components/projects/project-tabs'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { DeleteProjectButton } from '@/components/projects/delete-project-button'
import { TaskDetail } from '@/components/board/task-detail'

// En Next.js 16 params y searchParams llegan como promesas y hay que esperarlas.
type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ task?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const viewer = await requireViewer()
  const project = await getProject(id, viewer.orgId)
  return { title: project?.name ?? 'Proyecto' }
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const [{ id }, { task: taskId }] = await Promise.all([params, searchParams])
  const viewer = await requireViewer()

  const project = await getProject(id, viewer.orgId)
  // getProject filtra por orgId, así que un id de otra organización también
  // acaba aquí: no existe desde el punto de vista de quien mira.
  if (!project) notFound()

  const [tasks, backlog, members, projects, taskDetail] = await Promise.all([
    getProjectTasks(project.id, viewer.orgId),
    getProjectBacklog(project.id, viewer.orgId),
    getOrgMembers(viewer.orgId),
    getProjectOptions(viewer.orgId),
    taskId ? getTaskDetail(taskId, viewer.orgId) : Promise.resolve(null),
  ])

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    avatarSeed: m.user.avatarSeed,
  }))

  const done = tasks.filter((task) => task.status === 'DONE').length
  const progress = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)
  const color = projectColor(project.colorSeed)
  const late = isOverdue(project.dueDate) && project.status === 'ACTIVE'

  return (
    <div className="mx-auto max-w-[1600px] p-5 sm:p-8">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Proyectos
      </Link>

      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold text-white',
                color.bg,
              )}
            >
              {project.key}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight">{project.name}</h1>
                <Badge className={PROJECT_STATUS_STYLES[project.status]}>
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {plural(members.length, 'miembro')}
                </span>
                {project.dueDate && (
                  <span
                    className={cn('flex items-center gap-1.5', late && 'font-semibold text-destructive')}
                  >
                    <CalendarDays className="size-3.5" />
                    Entrega {formatDate(project.dueDate)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {project.description && (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {can(viewer.permissions, 'project:update') && (
            <ProjectDialog
              trigger="Editar"
              project={{
                id: project.id,
                name: project.name,
                key: project.key,
                description: project.description,
                status: project.status,
                colorSeed: project.colorSeed,
                dueDate: project.dueDate,
              }}
            />
          )}
          {can(viewer.permissions, 'project:delete') && (
            <DeleteProjectButton projectId={project.id} projectName={project.name} />
          )}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">Progreso del proyecto</span>
          <span className="tabular text-sm text-muted-foreground">
            {done} de {tasks.length} completadas · {progress}%
          </span>
        </div>
        <Progress value={progress} />
      </div>

      <ProjectTabs projectId={project.id} backlogCount={backlog.length} boardCount={tasks.length} />

      <ProjectBoard
        tasks={tasks}
        permissions={viewer.permissions}
        members={memberOptions}
        projects={projects}
        projectId={project.id}
      />

      {taskDetail && (
        <TaskDetail
          task={taskDetail}
          permissions={viewer.permissions}
          viewerId={viewer.id}
          members={memberOptions}
          projects={projects}
        />
      )}
    </div>
  )
}
