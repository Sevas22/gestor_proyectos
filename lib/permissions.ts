import { Role } from '@prisma/client'

/// Acciones que el servidor sabe autorizar. Cada mutación comprueba una de estas
/// antes de tocar la base de datos.
export type Permission =
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'task:create'
  | 'task:update'
  | 'task:move'
  | 'task:assign'
  | 'task:delete'
  | 'comment:create'
  | 'comment:delete'
  | 'member:invite'
  | 'member:approve'
  | 'member:update_role'
  | 'member:remove'
  | 'org:update'

const MATRIX: Record<Role, readonly Permission[]> = {
  ADMIN: [
    'project:create',
    'project:update',
    'project:delete',
    'task:create',
    'task:update',
    'task:move',
    'task:assign',
    'task:delete',
    'comment:create',
    'comment:delete',
    'member:invite',
    'member:approve',
    'member:update_role',
    'member:remove',
    'org:update',
  ],
  MANAGER: [
    'project:create',
    'project:update',
    'project:delete',
    'task:create',
    'task:update',
    'task:move',
    'task:assign',
    'task:delete',
    'comment:create',
    'comment:delete',
    'member:invite',
  ],
  DEVELOPER: ['task:create', 'task:update', 'task:move', 'task:assign', 'comment:create'],
  // Solo lectura. Deliberadamente sin ningún permiso de escritura.
  VIEWER: [],
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission)
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor de proyecto',
  DEVELOPER: 'Desarrollador',
  VIEWER: 'Observador',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Control total: proyectos, tareas, miembros y ajustes de la organización.',
  MANAGER: 'Crea y gestiona proyectos y tareas. Puede invitar miembros.',
  DEVELOPER: 'Crea y actualiza tareas, las mueve en el tablero y comenta.',
  VIEWER: 'Solo lectura. No puede modificar nada.',
}

export const ROLE_ORDER: readonly Role[] = ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER']
