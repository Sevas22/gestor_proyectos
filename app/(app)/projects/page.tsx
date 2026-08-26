import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, FolderKanban, ListTodo, Plus } from 'lucide-react'

import { requireViewer } from '@/lib/dal'
import { can } from '@/lib/permissions'
import { getProjects } from '@/lib/queries'
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
  formatDate,
  isOverdue,
  projectColor,
  plural,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shell/app-shell'
import { Badge, Card, EmptyState, Progress } from '@/components/ui/primitives'
import { ProjectDialog } from '@/components/projects/project-dialog'

export const metadata: Metadata = { title: 'Proyectos' }

export default async function ProjectsPage() {
  const viewer = await requireViewer()
  const projects = await getProjects(viewer.orgId)
  const canCreate = can(viewer.role, 'project:create')

  return (
    <div className="mx-auto max-w-[1400px] p-5 sm:p-8">
      <PageHeader
        eyebrow={
          <>
            <FolderKanban className="size-3.5" />
            {viewer.orgName}
          </>
        }
        title="Proyectos"
        description="Cada proyecto agrupa sus tareas en un tablero propio."
        action={canCreate ? <ProjectDialog trigger="Nuevo proyecto" /> : undefined}
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="size-5" />}
            title="Todavía no hay proyectos"
            description={
              canCreate
                ? 'Crea el primero y empieza a repartir tareas entre el equipo.'
                : 'Cuando alguien del equipo cree un proyecto, aparecerá aquí.'
            }
            action={canCreate ? <ProjectDialog trigger="Crear el primer proyecto" /> : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const color = projectColor(project.colorSeed)
            const late = isOverdue(project.dueDate) && project.status === 'ACTIVE'
            return (
              <Card key={project.id} className="flex flex-col transition-shadow hover:shadow-md">
                <Link href={`/projects/${project.id}`} className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'flex size-9 items-center justify-center rounded-lg font-mono text-[10px] font-bold text-white',
                          color.bg,
                        )}
                      >
                        {project.key}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{project.name}</p>
                        <p className="tabular text-[11px] text-muted-foreground">
                          {plural(project.taskCount, 'tarea')}
                        </p>
                      </div>
                    </div>
                    <Badge className={PROJECT_STATUS_STYLES[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </div>

                  <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                    {project.description || 'Sin descripción.'}
                  </p>

                  <div className="mt-auto pt-5">
                    <div className="mb-2 flex items-baseline justify-between text-[11px]">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="tabular font-semibold">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-1.5" />

                    <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <ListTodo className="size-3.5" />
                        {project.doneCount}/{project.taskCount} completadas
                      </span>
                      {project.dueDate && (
                        <span
                          className={cn(
                            'flex items-center gap-1.5',
                            late && 'font-semibold text-destructive',
                          )}
                        >
                          <CalendarDays className="size-3.5" />
                          {formatDate(project.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </Card>
            )
          })}

          {canCreate && (
            <ProjectDialog
              trigger={
                <span className="flex min-h-[13rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-foreground">
                  <Plus className="size-5" />
                  Nuevo proyecto
                </span>
              }
              unstyledTrigger
            />
          )}
        </div>
      )}
    </div>
  )
}
