import { Priority, ProjectStatus, TaskStatus } from '@prisma/client'

// Etiquetas y colores. Vive aparte de los componentes para que una tarea se vea
// igual en el tablero, en la tabla y en el feed de actividad.

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisión',
  DONE: 'Completada',
}

/// Estados que sí son columnas del tablero. El tipo excluye BACKLOG a
/// propósito, para que el compilador avise si alguien intenta pintarlo como una
/// columna más: es un depósito aparte con su propia pantalla, y un backlog de
/// cien elementos ahogaría el Kanban.
export type BoardStatus = Exclude<TaskStatus, 'BACKLOG'>

export const TASK_STATUS_ORDER: readonly BoardStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
]

/// Todos los estados, para los filtros y los desplegables donde sí hay que poder
/// elegir el backlog.
export const ALL_TASK_STATUSES: readonly TaskStatus[] = ['BACKLOG', ...TASK_STATUS_ORDER]

/// Al sacar algo del backlog entra por aquí.
export const FIRST_BOARD_STATUS: BoardStatus = 'TODO'

/// Clases de Tailwind completas, no interpoladas. Tailwind analiza el código
/// fuente en busca de nombres de clase literales: `bg-${color}-500` no genera
/// ningún CSS y por eso la maqueta original salía en gris.
export const TASK_STATUS_STYLES: Record<TaskStatus, { dot: string; chip: string; bar: string }> = {
  BACKLOG: {
    dot: 'bg-violet-400',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    bar: 'bg-violet-400',
  },
  TODO: {
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    bar: 'bg-slate-400',
  },
  IN_PROGRESS: {
    dot: 'bg-sky-500',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    bar: 'bg-sky-500',
  },
  IN_REVIEW: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  DONE: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const PRIORITY_ORDER: readonly Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

export const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Activo',
  PAUSED: 'En pausa',
  COMPLETED: 'Completado',
  ARCHIVED: 'Archivado',
}

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  COMPLETED: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  ARCHIVED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

/// Paleta de roles. El índice lo guarda TeamRole.colorSeed, así que un rol
/// conserva su color en todas las pantallas aunque le cambien el nombre.
const ROLE_COLORS = [
  { chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', dot: 'bg-violet-500' },
  { chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', dot: 'bg-sky-500' },
  { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
  { chip: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', dot: 'bg-orange-500' },
  { chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', dot: 'bg-rose-500' },
]

export function roleColor(seed: number) {
  return ROLE_COLORS[Math.abs(seed) % ROLE_COLORS.length]
}

/// Paleta de avatares. El índice se guarda en User.avatarSeed para que el color
/// de una persona no cambie entre pantallas.
const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
]

export function avatarColor(seed: number) {
  return AVATAR_COLORS[Math.abs(seed) % AVATAR_COLORS.length]
}

/// Paleta de acentos de proyecto. Mismo criterio: índice guardado en la fila.
const PROJECT_COLORS = [
  { bg: 'bg-violet-500', soft: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-sky-500', soft: 'bg-sky-100 dark:bg-sky-950', text: 'text-sky-600 dark:text-sky-400' },
  { bg: 'bg-emerald-500', soft: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-orange-500', soft: 'bg-orange-100 dark:bg-orange-950', text: 'text-orange-600 dark:text-orange-400' },
  { bg: 'bg-rose-500', soft: 'bg-rose-100 dark:bg-rose-950', text: 'text-rose-600 dark:text-rose-400' },
  { bg: 'bg-cyan-500', soft: 'bg-cyan-100 dark:bg-cyan-950', text: 'text-cyan-600 dark:text-cyan-400' },
]

export function projectColor(seed: number) {
  return PROJECT_COLORS[Math.abs(seed) % PROJECT_COLORS.length]
}

/// Convierte "2026-09-30" (lo que emite <input type="date">) en un Date a
/// medianoche **local**.
///
/// `new Date('2026-09-30')` no vale: la especificación obliga a interpretar las
/// cadenas de solo fecha como UTC, así que en Colombia (UTC-5) esa fecha se
/// convierte en el 29 a las 19:00 y la interfaz muestra el día anterior.
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) {
    // Cualquier otro formato (una fecha con hora, por ejemplo) sí se puede
    // delegar en el constructor.
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null

  // El constructor de Date desborda en silencio: (2026, 12, 1) es enero de 2027
  // y (2026, 1, 29) es el 1 de marzo. Un <input type="date"> nunca manda eso,
  // pero una petición fabricada a mano sí, así que se comprueba que la fecha
  // construida sea la que se pidió.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/// El camino de vuelta: de Date al valor que espera <input type="date">.
/// Usa los componentes locales por el mismo motivo — toISOString() desplaza al
/// día anterior o al siguiente según el huso.
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/// «1 tarea» / «3 tareas». Evita repetir el mismo ternario por toda la interfaz,
/// que es donde se colaban descuidos como «1 proyectos activos».
/// Si el plural no es simplemente añadir una -s, se pasa entero.
export function plural(count: number, singular: string, many?: string) {
  return `${count} ${count === 1 ? singular : (many ?? `${singular}s`)}`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const RELATIVE_UNITS: [limit: number, divisor: number, unit: Intl.RelativeTimeFormatUnit][] = [
  [60, 1, 'second'],
  [3600, 60, 'minute'],
  [86400, 3600, 'hour'],
  [604800, 86400, 'day'],
  [2629800, 604800, 'week'],
  [31557600, 2629800, 'month'],
  [Infinity, 31557600, 'year'],
]

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

export function relativeTime(date: Date | string) {
  const value = typeof date === 'string' ? new Date(date) : date
  const seconds = (value.getTime() - Date.now()) / 1000
  const abs = Math.abs(seconds)
  const [, divisor, unit] = RELATIVE_UNITS.find(([limit]) => abs < limit)!
  return relativeFormatter.format(Math.round(seconds / divisor), unit)
}

const dateFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const longDateFormatter = new Intl.DateTimeFormat('es', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatDate(date: Date | string) {
  return dateFormatter.format(typeof date === 'string' ? new Date(date) : date)
}

export function formatShortDate(date: Date | string) {
  return shortDateFormatter.format(typeof date === 'string' ? new Date(date) : date)
}

export function formatLongDate(date: Date | string) {
  return longDateFormatter.format(typeof date === 'string' ? new Date(date) : date)
}

/// Para el saludo de la cabecera.
export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

/// true si la fecha ya pasó (comparando por día, no por instante).
export function isOverdue(date: Date | string | null) {
  if (!date) return false
  const value = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return value < today
}
