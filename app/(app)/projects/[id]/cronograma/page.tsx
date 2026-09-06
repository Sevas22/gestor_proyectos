import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarRange } from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import { can } from '@/lib/permissions'
import {
  getProject,
  getProjectBacklog,
  getProjectStories,
  getProjectTasks,
  getStoryDetail,
} from '@/lib/queries'
import { plural, projectColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ProjectTabs } from '@/components/projects/project-tabs'
import { ProjectTimeline } from '@/components/timeline/project-timeline'
import { StoryDialog } from '@/components/timeline/story-dialog'
import { StoryDetail } from '@/components/timeline/story-detail'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ story?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const viewer = await requireViewer()
  const project = await getProject(id, viewer.orgId)
  return { title: project ? `Cronograma · ${project.name}` : 'Cronograma' }
}

export default async function CronogramaPage({ params, searchParams }: Props) {
  const [{ id }, { story: storyId }] = await Promise.all([params, searchParams])
  const viewer = await requireViewer()

  const project = await getProject(id, viewer.orgId)
  if (!project) notFound()

  const [stories, boardTasks, backlog, storyDetail] = await Promise.all([
    getProjectStories(project.id, viewer.orgId),
    getProjectTasks(project.id, viewer.orgId),
    getProjectBacklog(project.id, viewer.orgId),
    storyId ? getStoryDetail(storyId, viewer.orgId) : Promise.resolve(null),
  ])

  const color = projectColor(project.colorSeed)
  const programadas = stories.filter((s) => s.startDate && s.endDate).length

  return (
    <div className="mx-auto max-w-[1400px] p-5 sm:p-8">
      <Link
        href="/projects"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Proyectos
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
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
            <h1 className="truncate text-2xl font-bold tracking-tight">{project.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="size-3.5" />
              Cronograma · {plural(stories.length, 'historia', 'historias')}
              {stories.length > 0 && `, ${programadas} en la línea de tiempo`}
            </p>
          </div>
        </div>

        {can(viewer.permissions, 'story:create') && stories.length > 0 && (
          <StoryDialog trigger="Nueva historia" projectId={project.id} />
        )}
      </div>

      <ProjectTabs
        projectId={project.id}
        backlogCount={backlog.length}
        boardCount={boardTasks.length}
        storyCount={stories.length}
      />

      <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
        Cada barra es una historia de usuario, de su fecha de inicio a la de fin. La zona más oscura
        dentro de la barra es cuánto de su trabajo está terminado. Pulsa una para ver sus tareas.
      </p>

      <ProjectTimeline
        stories={stories}
        permissions={viewer.permissions}
        projectId={project.id}
      />

      {storyDetail && <StoryDetail story={storyDetail} permissions={viewer.permissions} />}
    </div>
  )
}
