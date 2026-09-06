'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange } from 'lucide-react'

import { can, type Permission } from '@/lib/permissions'
import { Card, EmptyState } from '@/components/ui/primitives'
import { GanttChart, UnscheduledStories, type TimelineStory } from '@/components/timeline/gantt-chart'
import { StoryDialog } from '@/components/timeline/story-dialog'

/// Une el cronograma con el formulario de historia.
///
/// Abrir una historia navega a `?story=<id>` en vez de guardarla en el estado
/// del cliente: el detalle lo renderiza el servidor con sus tareas al día, la
/// URL se puede compartir y el botón «atrás» cierra el panel.
export function ProjectTimeline({
  stories,
  permissions,
  projectId,
}: {
  stories: TimelineStory[]
  permissions: Permission[]
  projectId: string
}) {
  const router = useRouter()

  const openStory = useCallback(
    (storyId: string) => {
      router.push(`/projects/${projectId}/cronograma?story=${storyId}`, { scroll: false })
    },
    [router, projectId],
  )

  const canCreate = can(permissions, 'story:create')
  const programadas = stories.filter((s) => s.startDate && s.endDate)
  const sinProgramar = stories.filter((s) => !s.startDate || !s.endDate)

  if (stories.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title="El cronograma está vacío"
          description={
            canCreate
              ? 'Crea la primera historia de usuario, ponle fechas y aparecerá en la línea de tiempo. Después le enganchas las tareas que hagan falta.'
              : 'Cuando alguien del equipo planifique historias, aparecerán aquí.'
          }
          action={
            canCreate ? (
              <StoryDialog trigger="Nueva historia" projectId={projectId} />
            ) : undefined
          }
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {programadas.length > 0 ? (
        <GanttChart stories={programadas} onOpenStory={openStory} />
      ) : (
        <Card>
          <EmptyState
            icon={<CalendarRange className="size-5" />}
            title="Ninguna historia tiene fechas todavía"
            description="Las historias existen, pero sin inicio y fin no se pueden colocar en la línea de tiempo. Ábrelas y ponles fechas."
          />
        </Card>
      )}

      <UnscheduledStories stories={sinProgramar} onOpenStory={openStory} />
    </div>
  )
}
