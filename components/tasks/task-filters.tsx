'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { TaskStatus } from '@prisma/client'

import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/primitives'

/// Los filtros viven en la URL, no en el estado del componente: así se pueden
/// compartir, sobreviven a recargar la página y la consulta la resuelve el
/// servidor en vez de filtrar en el navegador una lista ya descargada.
export function TaskFilters({
  projects,
  scope,
  status,
  projectId,
}: {
  projects: { id: string; name: string; key: string }[]
  scope: 'mine' | 'all'
  status?: TaskStatus
  projectId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/tasks?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="flex rounded-lg border border-border p-0.5"
        role="group"
        aria-label="Ámbito de las tareas"
      >
        {(
          [
            ['mine', 'Mías'],
            ['all', 'Todas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => setParam('scope', value === 'mine' ? null : 'all')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              scope === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Select
        aria-label="Filtrar por estado"
        value={status ?? ''}
        onChange={(event) => setParam('status', event.target.value || null)}
        className="w-auto min-w-40"
      >
        <option value="">Todos los estados</option>
        {TASK_STATUS_ORDER.map((value) => (
          <option key={value} value={value}>
            {TASK_STATUS_LABELS[value]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filtrar por proyecto"
        value={projectId ?? ''}
        onChange={(event) => setParam('project', event.target.value || null)}
        className="w-auto min-w-44"
      >
        <option value="">Todos los proyectos</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.key} · {project.name}
          </option>
        ))}
      </Select>

      {(status || projectId || scope === 'all') && (
        <button
          type="button"
          onClick={() => router.push('/tasks', { scroll: false })}
          className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
