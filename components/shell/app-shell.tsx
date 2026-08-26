'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Command, LogOut, Menu } from 'lucide-react'

import type { Viewer } from '@/lib/dal'
import { plural, roleColor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, Badge } from '@/components/ui/primitives'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import { ThemeToggle } from '@/components/shell/theme-toggle'

/// Marco de la aplicación: barra lateral fija en escritorio, cajón deslizante en
/// móvil. Es cliente porque gestiona la apertura del cajón; el contenido llega
/// como children ya renderizado en el servidor.
export function AppShell({
  viewer,
  counts,
  logoutAction,
  children,
}: {
  viewer: Viewer
  counts: Partial<Record<string, number>>
  logoutAction: () => Promise<void>
  children: ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Command className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold tracking-tight">nucleus</p>
          <p className="truncate text-[11px] text-muted-foreground">gestor de proyectos</p>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-xs font-bold text-accent-foreground">
          {viewer.orgName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{viewer.orgName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {plural(counts['/team'] ?? 1, 'miembro')}
          </p>
        </div>
      </div>

      <SidebarNav counts={counts} onNavigate={() => setDrawerOpen(false)} />

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl bg-accent/60 p-3">
          <Avatar name={viewer.name} seed={viewer.avatarSeed} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{viewer.name}</p>
            <Badge className={cn('mt-0.5', roleColor(viewer.roleColorSeed).chip)}>{viewer.roleName}</Badge>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        {sidebarContent}
      </aside>

      {/* Cajón móvil */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Cerrar menú"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-foreground/30"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-sidebar shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
            >
              <Menu className="size-4" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Command className="size-3.5" />
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Avatar name={viewer.name} seed={viewer.avatarSeed} size="md" />
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

/// Encabezado de página. Se repite en todas las pantallas del panel.
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
