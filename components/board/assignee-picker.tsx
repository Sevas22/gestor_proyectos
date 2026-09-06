'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/primitives'
import { plural } from '@/lib/format'

export type MemberChoice = { id: string; name: string; avatarSeed: number }

/// Selector de responsables. Varias personas pueden llevar la misma tarea.
///
/// Se hace con casillas y no con un `<select multiple>` porque ese control es
/// prácticamente inusable: obliga a mantener Ctrl pulsado para elegir varios y
/// no muestra las caras. Aquí cada opción es un botón con su avatar, y las
/// casillas ocultas son lo que viaja en el formulario.
export function AssigneePicker({
  members,
  defaultSelected = [],
  name = 'assigneeIds',
}: {
  members: MemberChoice[]
  defaultSelected?: string[]
  name?: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected))

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (members.length === 0) {
    return (
      <p className="rounded-lg bg-accent px-3 py-2 text-[11px] text-muted-foreground">
        No hay miembros a quien asignar.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Lo que se envía. Van fuera del bucle visual para que desmarcar a
          alguien no deje su input suelto en el DOM. */}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Responsables">
        {members.map((member) => {
          const on = selected.has(member.id)
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => toggle(member.id)}
              aria-pressed={on}
              className={cn(
                'flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs transition-colors',
                on
                  ? 'border-primary bg-primary/10 font-semibold text-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Avatar name={member.name} seed={member.avatarSeed} size="sm" />
              <span className="max-w-32 truncate">{member.name}</span>
              {on && <Check className="size-3 shrink-0 text-primary" />}
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {selected.size === 0
          ? 'Sin asignar. Puedes elegir a varias personas.'
          : plural(selected.size, 'responsable')}
      </p>
    </div>
  )
}
