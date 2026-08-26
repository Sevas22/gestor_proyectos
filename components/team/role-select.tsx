'use client'

import type { ComponentProps } from 'react'

import { Select } from '@/components/ui/primitives'

/// Un rol tal y como lo necesitan los selectores: lo justo para mostrarlo y
/// enviarlo. Los permisos no viajan al cliente porque quien decide es el
/// servidor.
export type RoleOption = {
  id: string
  name: string
  colorSeed: number
  description: string
}

/// Desplegable de roles. Se usa en el alta, en la aprobación y en la fila de
/// cada miembro, así que vive aquí en vez de repetirse tres veces.
///
/// La lista que recibe ya viene filtrada por el servidor a los roles que quien
/// mira puede conceder: si no se pudieran repartir, no deberían ni ofrecerse.
export function RoleSelect({
  roles,
  ...props
}: ComponentProps<'select'> & { roles: RoleOption[] }) {
  if (roles.length === 0) {
    return (
      <p className="rounded-lg bg-accent px-3 py-2 text-[11px] text-muted-foreground">
        No hay roles que puedas asignar.
      </p>
    )
  }

  return (
    <Select {...props}>
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </Select>
  )
}
