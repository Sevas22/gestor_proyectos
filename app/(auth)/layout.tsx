import Link from 'next/link'
import { Command } from 'lucide-react'

import type { ReactNode } from 'react'

/// Marco de las pantallas de acceso: panel de presentación a la izquierda en
/// escritorio, formulario a la derecha. En móvil solo queda el formulario.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        {/* Trama decorativa: dos halos suaves sobre el color primario. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(255,255,255,.35), transparent 45%), radial-gradient(circle at 85% 75%, rgba(255,255,255,.22), transparent 45%)',
          }}
        />

        <Link href="/" className="relative flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur">
            <Command className="size-4" />
          </div>
          <span className="font-mono text-sm font-bold tracking-tight">nucleus</span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-bold tracking-tight text-balance">
            El trabajo del equipo, en un solo sitio.
          </h2>
          <p className="mt-4 text-sm leading-7 text-primary-foreground/80">
            Proyectos, tablero Kanban, roles con permisos reales y un registro de todo lo que pasa.
            Sin hojas de cálculo sueltas ni hilos de chat perdidos.
          </p>
        </div>

        <dl className="relative grid grid-cols-3 gap-4 text-primary-foreground/85">
          {[
            ['Tablero', 'Arrastra y suelta'],
            ['Roles', 'Permisos por rol'],
            ['Actividad', 'Todo queda registrado'],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="text-xs font-bold tracking-[0.16em] uppercase">{term}</dt>
              <dd className="mt-1 text-[11px] leading-5 text-primary-foreground/70">{detail}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <main className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
