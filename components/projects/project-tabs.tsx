'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { KanbanSquare, Layers } from 'lucide-react'

import { cn } from '@/lib/utils'

/// Pestañas del proyecto: tablero y backlog.
///
/// Son enlaces y no estado del cliente para que cada vista tenga su URL: se
/// puede compartir «el backlog del portal web» y el botón atrás funciona.
export function ProjectTabs({
  projectId,
  backlogCount,
  boardCount,
}: {
  projectId: string
  backlogCount: number
  boardCount: number
}) {
  const pathname = usePathname()

  const tabs = [
    { href: `/projects/${projectId}`, label: 'Tablero', icon: KanbanSquare, count: boardCount },
    {
      href: `/projects/${projectId}/backlog`,
      label: 'Backlog',
      icon: Layers,
      count: backlogCount,
    },
  ]

  return (
    <div className="mb-6 flex gap-1 border-b border-border" role="tablist">
      {tabs.map(({ href, label, icon: Icon, count }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
            <span
              className={cn(
                'tabular rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                active ? 'bg-primary/10 text-primary' : 'bg-accent text-muted-foreground',
              )}
            >
              {count}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
