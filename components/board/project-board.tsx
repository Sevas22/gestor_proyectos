'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TaskStatus } from '@prisma/client'

import type { Permission } from '@/lib/permissions'
import { TaskDialog, type TaskFormValues } from '@/components/board/task-dialog'
import { KanbanBoard, type BoardTask } from '@/components/board/kanban-board'

export type MemberOption = { id: string; name: string; avatarSeed: number }
export type ProjectOption = { id: string; name: string; key: string; colorSeed: number }

/// Une el tablero con el diálogo de creación/edición.
///
/// Abrir una tarea navega a `?task=<id>` en vez de guardar la tarea en el estado
/// del cliente: así el detalle lo renderiza el servidor con sus comentarios
/// frescos, la URL se puede compartir, y el botón «atrás» del navegador cierra
/// el panel como espera cualquiera.
export function ProjectBoard({
  tasks,
  permissions,
  members,
  projects,
  projectId,
}: {
  tasks: BoardTask[]
  permissions: Permission[]
  members: MemberOption[]
  projects: ProjectOption[]
  projectId: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState<TaskStatus | null>(null)

  const openTask = useCallback(
    (taskId: string) => {
      router.push(`/projects/${projectId}?task=${taskId}`, { scroll: false })
    },
    [router, projectId],
  )

  const initialValues: TaskFormValues | undefined = creating
    ? { projectId, status: creating }
    : undefined

  return (
    <>
      <KanbanBoard tasks={tasks} permissions={permissions} onOpenTask={openTask} onCreateTask={setCreating} />

      <TaskDialog
        open={creating !== null}
        onClose={() => setCreating(null)}
        members={members}
        projects={projects}
        values={initialValues}
      />
    </>
  )
}
