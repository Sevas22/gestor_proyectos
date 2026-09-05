import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Layers } from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import {
  getOrgMembers,
  getProject,
  getProjectBacklog,
  getProjectOptions,
  getProjectTasks,
  getTaskDetail,
} from '@/lib/queries'
import { plural, projectColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ProjectTabs } from '@/components/projects/project-tabs'
import { ProjectBacklog } from '@/components/board/project-backlog'
import { TaskDetail } from '@/components/board/task-detail'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ task?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const viewer = await requireViewer()
  const project = await getProject(id, viewer.orgId)
  return { title: project ? `Backlog · ${project.name}` : 'Backlog' }
}

export default async function BacklogPage({ params, searchParams }: Props) {
  const [{ id }, { task: taskId }] = await Promise.all([params, searchParams])
  const viewer = await requireViewer()

  const project = await getProject(id, viewer.orgId)
  if (!project) notFound()

  const [backlog, boardTasks, members, projects, taskDetail] = await Promise.all([
    getProjectBacklog(project.id, viewer.orgId),
    getProjectTasks(project.id, viewer.orgId),
    getOrgMembers(viewer.orgId),
    getProjectOptions(viewer.orgId),
    taskId ? getTaskDetail(taskId, viewer.orgId) : Promise.resolve(null),
  ])

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    avatarSeed: m.user.avatarSeed,
  }))

  const color = projectColor(project.colorSeed)

  return (
    <div className="mx-auto max-w-[1100px] p-5 sm:p-8">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Proyectos
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold text-white',
            color.bg,
          )}
        >
          {project.key}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="size-3.5" />
            Backlog · {plural(backlog.length, 'elemento')} por priorizar
          </p>
        </div>
      </div>

      <ProjectTabs
        projectId={project.id}
        backlogCount={backlog.length}
        boardCount={boardTasks.length}
      />

      <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
        Lo que está aquí todavía no cuenta como trabajo comprometido: no aparece en el tablero ni
        en el progreso del proyecto. El orden es la prioridad — lo de arriba es lo siguiente que
        entrará.
      </p>

      <ProjectBacklog
        tasks={backlog}
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
