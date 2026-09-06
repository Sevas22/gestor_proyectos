import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/primitives'

export type AssigneeSummary = { id: string; name: string; avatarSeed: number }

/// Los responsables de una tarea, superpuestos.
///
/// A partir de `max` deja de apilar y muestra «+N»: con seis avatares en una
/// tarjeta de tablero no se distingue ninguno, y el nombre completo está en el
/// detalle de la tarea.
export function AssigneeStack({
  assignees,
  size = 'sm',
  max = 3,
  className,
}: {
  assignees: AssigneeSummary[]
  size?: 'sm' | 'md'
  max?: number
  className?: string
}) {
  if (assignees.length === 0) {
    return (
      <span
        title="Sin asignar"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground',
          size === 'sm' ? 'size-6 text-[9px]' : 'size-8 text-[11px]',
          className,
        )}
      >
        ?
      </span>
    )
  }

  const visibles = assignees.slice(0, max)
  const restantes = assignees.length - visibles.length

  return (
    <span
      className={cn('flex shrink-0 items-center', className)}
      title={assignees.map((a) => a.name).join(', ')}
    >
      {visibles.map((person, index) => (
        <Avatar
          key={person.id}
          name={person.name}
          seed={person.avatarSeed}
          size={size}
          // El anillo del color de la tarjeta separa los avatares superpuestos.
          className={cn('ring-2 ring-card', index > 0 && '-ml-2')}
        />
      ))}
      {restantes > 0 && (
        <span
          className={cn(
            'tabular -ml-2 flex items-center justify-center rounded-full bg-muted font-bold text-muted-foreground ring-2 ring-card',
            size === 'sm' ? 'size-6 text-[9px]' : 'size-8 text-[10px]',
          )}
        >
          +{restantes}
        </span>
      )}
    </span>
  )
}
