'use client'

import { useMemo, useState } from 'react'
import type { StoryStatus } from '@prisma/client'

import {
  STORY_STATUS_LABELS,
  STORY_STATUS_STYLES,
  addDays,
  daysBetween,
  formatShortDate,
  plural,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'

export type TimelineStory = {
  id: string
  number: number
  title: string
  status: StoryStatus
  startDate: Date | null
  endDate: Date | null
  colorSeed: number
  taskCount: number
  doneCount: number
  progress: number
  project: { key: string }
}

/// Ancho de un día en píxeles según la escala. Es lo único que cambia entre
/// vistas: todo lo demás se calcula a partir de aquí.
const ESCALAS = {
  dias: { label: 'Días', dayWidth: 34, etiquetaCada: 1 },
  semanas: { label: 'Semanas', dayWidth: 14, etiquetaCada: 7 },
  meses: { label: 'Meses', dayWidth: 5, etiquetaCada: 30 },
} as const

type Escala = keyof typeof ESCALAS

const DIAS_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

/// Cronograma de historias como barras sobre una línea de tiempo.
///
/// Se dibuja con posicionamiento absoluto sobre un contenedor con scroll
/// horizontal, en vez de con una rejilla CSS: una barra tiene que empezar y
/// acabar en un día concreto, y con `left` y `width` en píxeles eso es
/// aritmética directa. Con grid habría que generar una columna por día y
/// mapear cada barra a un rango de columnas, que es más frágil y más lento
/// cuando el rango abarca meses.
export function GanttChart({
  stories,
  onOpenStory,
}: {
  stories: TimelineStory[]
  onOpenStory: (storyId: string) => void
}) {
  const [escala, setEscala] = useState<Escala>('semanas')
  const { dayWidth } = ESCALAS[escala]

  const programadas = useMemo(
    () => stories.filter((s): s is TimelineStory & { startDate: Date; endDate: Date } =>
      Boolean(s.startDate && s.endDate),
    ),
    [stories],
  )

  // Rango que abarca el cronograma, con margen a los lados para que las barras
  // de los extremos no queden pegadas al borde.
  const rango = useMemo(() => {
    if (programadas.length === 0) return null
    const inicios = programadas.map((s) => s.startDate.getTime())
    const fines = programadas.map((s) => s.endDate.getTime())
    const desde = addDays(new Date(Math.min(...inicios)), -3)
    const hasta = addDays(new Date(Math.max(...fines)), 3)
    return { desde, hasta, dias: daysBetween(desde, hasta) }
  }, [programadas])

  if (!rango) return null

  const anchoTotal = rango.dias * dayWidth
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const offsetHoy = daysBetween(rango.desde, hoy) - 1
  const hoyVisible = offsetHoy >= 0 && offsetHoy < rango.dias

  // Marcas de la cabecera: una cada `etiquetaCada` días, más el primer día de
  // cada mes, que es lo que orienta de verdad al leer un cronograma largo.
  const marcas: { offset: number; texto: string; esMes: boolean }[] = []
  for (let i = 0; i < rango.dias; i++) {
    const fecha = addDays(rango.desde, i)
    const primeroDeMes = fecha.getDate() === 1
    if (primeroDeMes) {
      marcas.push({
        offset: i,
        texto: fecha.toLocaleDateString('es', { month: 'short', year: '2-digit' }),
        esMes: true,
      })
    } else if (escala === 'dias') {
      marcas.push({
        offset: i,
        texto: `${DIAS_SEMANA[fecha.getDay()]}${fecha.getDate()}`,
        esMes: false,
      })
    } else if (escala === 'semanas' && fecha.getDay() === 1) {
      marcas.push({ offset: i, texto: String(fecha.getDate()), esMes: false })
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="font-semibold">Línea de tiempo</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {plural(programadas.length, 'historia programada', 'historias programadas')} ·{' '}
            {formatShortDate(rango.desde)} — {formatShortDate(rango.hasta)}
          </p>
        </div>

        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Escala">
          {(Object.keys(ESCALAS) as Escala[]).map((clave) => (
            <button
              key={clave}
              type="button"
              aria-pressed={escala === clave}
              onClick={() => setEscala(clave)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                escala === clave
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {ESCALAS[clave].label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ width: Math.max(anchoTotal, 600) }}>
          {/* Cabecera de fechas */}
          <div className="relative h-9 border-b border-border bg-accent/40">
            {marcas.map((marca) => (
              <span
                key={marca.offset}
                style={{ left: marca.offset * dayWidth }}
                className={cn(
                  'absolute top-0 flex h-9 items-center border-l pl-1.5 text-[10px] whitespace-nowrap',
                  marca.esMes
                    ? 'border-border font-bold text-foreground'
                    : 'border-border/40 text-muted-foreground',
                )}
              >
                {marca.texto}
              </span>
            ))}
          </div>

          {/* Filas */}
          <div className="relative">
            {hoyVisible && (
              <div
                aria-hidden
                style={{ left: offsetHoy * dayWidth }}
                className="pointer-events-none absolute inset-y-0 z-10 w-px bg-destructive/70"
              >
                <span className="absolute -top-0.5 -left-1 size-2 rounded-full bg-destructive" />
              </div>
            )}

            {programadas.map((story) => {
              const inicio = daysBetween(rango.desde, story.startDate) - 1
              const duracion = daysBetween(story.startDate, story.endDate)
              const estilo = STORY_STATUS_STYLES[story.status]

              return (
                <div
                  key={story.id}
                  className="relative h-12 border-b border-border/60 last:border-b-0 hover:bg-accent/30"
                >
                  <button
                    type="button"
                    onClick={() => onOpenStory(story.id)}
                    style={{ left: inicio * dayWidth, width: Math.max(duracion * dayWidth, 8) }}
                    title={`${story.project.key}-H${story.number}: ${story.title} · ${formatShortDate(story.startDate)} — ${formatShortDate(story.endDate)} · ${plural(duracion, 'día')}`}
                    className={cn(
                      'absolute top-2.5 flex h-7 items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[11px] font-semibold text-white shadow-sm transition-transform hover:z-20 hover:scale-[1.02]',
                      estilo.bar,
                    )}
                  >
                    {/* Relleno de avance dentro de la propia barra: se ve cuánto
                        va hecho sin ocupar otra columna. */}
                    {story.progress > 0 && (
                      <span
                        aria-hidden
                        style={{ width: `${story.progress}%` }}
                        className="absolute inset-y-0 left-0 bg-black/25"
                      />
                    )}
                    <span className="relative truncate">
                      {story.project.key}-H{story.number} · {story.title}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        {(Object.keys(STORY_STATUS_LABELS) as StoryStatus[]).map((estado) => (
          <span key={estado} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', STORY_STATUS_STYLES[estado].bar)} />
            {STORY_STATUS_LABELS[estado]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-destructive" />
          hoy
        </span>
        <span className="ml-auto">La zona oscura de cada barra es el avance de sus tareas.</span>
      </div>
    </div>
  )
}

/// Historias sin fechas: existen pero todavía no se han colocado.
export function UnscheduledStories({
  stories,
  onOpenStory,
}: {
  stories: TimelineStory[]
  onOpenStory: (storyId: string) => void
}) {
  if (stories.length === 0) return null

  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-5">
      <h3 className="text-sm font-semibold">Sin programar</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {plural(stories.length, 'historia', 'historias')} sin fechas. Ponles inicio y fin para que
        aparezcan en la línea de tiempo.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {stories.map((story) => (
          <li key={story.id}>
            <button
              type="button"
              onClick={() => onOpenStory(story.id)}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:bg-accent"
            >
              <span className={cn('size-2 rounded-full', STORY_STATUS_STYLES[story.status].dot)} />
              <span className="font-mono text-[10px] text-muted-foreground">
                {story.project.key}-H{story.number}
              </span>
              <span className="max-w-52 truncate font-medium">{story.title}</span>
              {story.taskCount > 0 && (
                <Badge className="bg-accent text-muted-foreground">
                  {story.doneCount}/{story.taskCount}
                </Badge>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
