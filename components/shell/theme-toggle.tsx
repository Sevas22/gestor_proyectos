'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'dark', label: 'Oscuro', icon: Moon },
]

/// Aplica el tema poniendo o quitando las clases .light / .dark en <html>.
/// globals.css contempla los tres casos: la clase manda, y si no hay ninguna
/// decide prefers-color-scheme.
function apply(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (theme !== 'system') root.classList.add(theme)
  localStorage.setItem('gestor-theme', theme)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  // Hasta que el componente se hidrata no sabemos qué guardó el usuario;
  // pintar antes daría un parpadeo con la opción equivocada resaltada.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('gestor-theme') as Theme | null
    if (stored === 'light' || stored === 'dark' || stored === 'system') setTheme(stored)
    setReady(true)
  }, [])

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
      role="group"
      aria-label="Tema de la interfaz"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={ready ? theme === value : undefined}
          onClick={() => {
            setTheme(value)
            apply(value)
          }}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            ready && theme === value
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  )
}
