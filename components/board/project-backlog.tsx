'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { Permission } from '@/lib/permissions'
import { TaskDialog, type TaskFormValues } from '@/components/board/task-dialog'
import { BacklogList } from '@/components/board/backlog-list'
import type { BoardTask } from '@/components/board/kanban-board'
import type { MemberOption, ProjectOption } from '@/components/board/project-board'

/// Une la lista del backlog con el diálogo de creación, igual que ProjectBoard
/// hace con el tablero. Lo que se crea aquí nace en estado BACKLOG.
export function ProjectBacklog({
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
  const [creating, setCreating] = useState(false)

  const openTask = useCallback(
    (taskId: string) => {
      router.push(`/projects/${projectId}/backlog?task=${taskId}`, { scroll: false })
    },
    [router, projectId],
  )

  return (
    <>
      <BacklogList
        tasks={tasks}
        permissions={permissions}
        onOpenTask={openTask}
        onCreateTask={() => setCreating(true)}
      />

      <TaskDialog
        open={creating}
        onClose={() => setCreating(false)}
        members={members}
        projects={projects}
        values={{ projectId, status: 'BACKLOG' } satisfies TaskFormValues}
      />
    </>
  )
}
