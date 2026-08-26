'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, FolderKanban, LayoutDashboard, ListTodo, Settings2, Users } from 'lucide-react'

import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/projects', label: 'Proyectos', icon: FolderKanban },
  { href: '/tasks', label: 'Mis tareas', icon: ListTodo },
  { href: '/team', label: 'Equipo', icon: Users },
] as const

const ADMIN_NAV = [{ href: '/settings', label: 'Ajustes', icon: Settings2 }] as const

export function SidebarNav({
  counts,
  onNavigate,
}: {
  counts?: Partial<Record<string, number>>
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function renderItem({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Activity }) {
    const active = isActive(href)
    const count = counts?.[href]
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
          active
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Icon className="size-4" />
        <span className="flex-1 text-left">{label}</span>
        {count !== undefined && count > 0 && (
          <span
            className={cn(
              'tabular text-[11px] font-semibold',
              active ? 'text-primary-foreground/75' : 'text-muted-foreground',
            )}
          >
            {count}
          </span>
        )}
      </Link>
    )
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-5" aria-label="Navegación principal">
      <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
        Workspace
      </p>
      {NAV.map(renderItem)}
      <p className="px-3 pt-7 pb-2 text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
        Administración
      </p>
      {ADMIN_NAV.map(renderItem)}
    </nav>
  )
}
