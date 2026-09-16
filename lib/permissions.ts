/// Acciones que el servidor sabe autorizar. Cada mutación comprueba una de
/// estas antes de tocar la base de datos.
///
/// Son claves de texto y no columnas de una tabla porque los roles guardan su
/// lista en `TeamRole.permissions`: añadir un permiso nuevo al producto es
/// añadir una entrada aquí, sin migrar el esquema.
export type Permission =
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'story:create'
  | 'story:update'
  | 'story:delete'
  | 'task:create'
  | 'task:update'
  | 'task:move'
  | 'task:assign'
  | 'task:delete'
  | 'comment:create'
  | 'comment:delete'
  | 'attachment:upload'
  | 'attachment:delete'
  | 'member:invite'
  | 'member:approve'
  | 'member:update_role'
  | 'member:remove'
  | 'member:reset_password'
  | 'role:manage'
  | 'org:update'

/// El catálogo agrupado alimenta la pantalla de roles. El texto vive aquí y no
/// en el componente para que un permiso nuevo aparezca en la interfaz solo con
/// añadirlo a esta lista.
export const PERMISSION_CATALOG: {
  group: string
  hint: string
  items: { key: Permission; label: string; description: string }[]
}[] = [
  {
    group: 'Proyectos',
    hint: 'Quién puede crear y organizar los proyectos del equipo.',
    items: [
      {
        key: 'project:create',
        label: 'Crear proyectos',
        description: 'Añadir proyectos nuevos a la organización.',
      },
      {
        key: 'project:update',
        label: 'Editar proyectos',
        description: 'Cambiar nombre, descripción, estado y fecha de entrega.',
      },
      {
        key: 'project:delete',
        label: 'Eliminar proyectos',
        description: 'Borrar un proyecto con todas sus tareas y comentarios.',
      },
    ],
  },
  {
    group: 'Historias de usuario',
    hint: 'La planificación: qué se va a hacer y cuándo, en el cronograma.',
    items: [
      {
        key: 'story:create',
        label: 'Crear historias',
        description: 'Añadir historias de usuario y colocarlas en el cronograma.',
      },
      {
        key: 'story:update',
        label: 'Editar historias',
        description: 'Cambiar el texto, el estado y las fechas de una historia.',
      },
      {
        key: 'story:delete',
        label: 'Eliminar historias',
        description: 'Borrar una historia. Sus tareas se conservan, sueltas.',
      },
    ],
  },
  {
    group: 'Tareas',
    hint: 'El trabajo del día a día en el tablero.',
    items: [
      { key: 'task:create', label: 'Crear tareas', description: 'Añadir tareas a cualquier proyecto.' },
      {
        key: 'task:update',
        label: 'Editar tareas',
        description: 'Cambiar título, descripción, prioridad y fecha límite.',
      },
      {
        key: 'task:move',
        label: 'Mover en el tablero',
        description: 'Arrastrar tarjetas entre columnas para cambiar su estado.',
      },
      {
        key: 'task:assign',
        label: 'Asignar responsable',
        description: 'Decidir quién se encarga de cada tarea.',
      },
      { key: 'task:delete', label: 'Eliminar tareas', description: 'Borrar tareas definitivamente.' },
    ],
  },
  {
    group: 'Comentarios',
    hint: 'La conversación dentro de cada tarea.',
    items: [
      { key: 'comment:create', label: 'Comentar', description: 'Escribir comentarios en las tareas.' },
      {
        key: 'comment:delete',
        label: 'Eliminar comentarios de otros',
        description: 'Cualquiera puede borrar los suyos; esto permite borrar los ajenos.',
      },
    ],
  },
  {
    group: 'Archivos',
    hint: 'Documentos adjuntos a las tareas.',
    items: [
      {
        key: 'attachment:upload',
        label: 'Adjuntar archivos',
        description: 'Subir PDF, imágenes y documentos a una tarea.',
      },
      {
        key: 'attachment:delete',
        label: 'Eliminar archivos de otros',
        description: 'Cualquiera puede borrar los suyos; esto permite borrar los ajenos.',
      },
    ],
  },
  {
    group: 'Equipo',
    hint: 'Quién entra, con qué rol, y quién sale.',
    items: [
      {
        key: 'member:invite',
        label: 'Dar de alta miembros',
        description: 'Crear cuentas y añadirlas al equipo directamente.',
      },
      {
        key: 'member:approve',
        label: 'Aprobar solicitudes',
        description: 'Resolver a quien pide entrar con el código del equipo.',
      },
      {
        key: 'member:update_role',
        label: 'Cambiar el rol de otros',
        description: 'Reasignar el rol de cualquier miembro del equipo.',
      },
      {
        key: 'member:remove',
        label: 'Retirar miembros',
        description: 'Quitar a alguien de la organización.',
      },
      {
        key: 'member:reset_password',
        label: 'Restablecer contraseñas',
        description:
          'Dar una contraseña temporal a quien olvidó la suya. Solo a quien no tenga más permisos que tú.',
      },
    ],
  },
  {
    group: 'Administración',
    hint: 'Configuración de la organización. Concede esto con cuidado.',
    items: [
      {
        key: 'role:manage',
        label: 'Gestionar roles',
        description: 'Crear, editar y eliminar los roles del equipo y sus permisos.',
      },
      {
        key: 'org:update',
        label: 'Editar la organización',
        description: 'Cambiar el nombre y los ajustes generales.',
      },
    ],
  },
]

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_CATALOG.flatMap((g) =>
  g.items.map((i) => i.key),
)

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS)

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value)
}

/// Permisos que un rol concede de verdad.
///
/// El rol de sistema los tiene todos por definición, aunque la lista guardada
/// en su fila sea de antes de que existiera alguno: así una función nueva no
/// deja fuera al administrador. Para el resto se filtra contra el catálogo, y
/// una clave que se retiró del producto no cuenta.
///
/// Toda comparación entre permisos tiene que pasar por aquí, nunca por la lista
/// guardada. Si no, al añadir un permiso se abre una escalada: quien tuviera
/// todos los anteriores vería que la lista guardada del administrador no le
/// supera, podría asignarse ese rol y recibiría con él el permiso nuevo.
export function effectivePermissions(role: {
  isSystem: boolean
  permissions: readonly string[]
}): Permission[] {
  return role.isSystem ? [...ALL_PERMISSIONS] : role.permissions.filter(isPermission)
}

/// Comprueba un permiso contra la lista que trae el rol de quien actúa.
export function can(permissions: readonly string[], permission: Permission): boolean {
  return permissions.includes(permission)
}

/// Permisos que un rol concede y quien mira NO posee.
///
/// Es la base de la regla «nadie reparte lo que no tiene»: sin ella, quien
/// pueda gestionar roles o dar de alta miembros se fabricaría un rol con
/// control total y se lo asignaría. Devuelve la lista para poder decir cuáles
/// faltan, no solo que falta alguno.
export function permissionsBeyond(
  granted: readonly string[],
  own: readonly string[],
): string[] {
  return granted.filter((permission) => !own.includes(permission))
}

/// Sin al menos una persona que pueda tocar esto, la organización se queda sin
/// forma de arreglar sus propios permisos. Es lo que protegen las salvaguardas
/// de `app/actions/roles.ts` y `app/actions/members.ts`.
export const LOCKOUT_PERMISSIONS: readonly Permission[] = ['member:update_role', 'role:manage']

/// Un permiso de gestión concedido por error es más caro de deshacer que uno de
/// trabajo. La interfaz los marca para que se vean.
export const SENSITIVE_PERMISSIONS: readonly Permission[] = [
  'attachment:delete',
  'story:delete',
  'member:update_role',
  'member:remove',
  // Quien restablece una contraseña conoce la temporal: puede entrar como esa
  // persona hasta que la cambie.
  'member:reset_password',
  'role:manage',
  'org:update',
  'project:delete',
]

/// Los cuatro roles con los que nace una organización. Son un punto de partida
/// razonable, no una lista cerrada: se pueden editar y borrar todos salvo el
/// administrador.
export const DEFAULT_ROLES: {
  name: string
  description: string
  permissions: Permission[]
  colorSeed: number
  isSystem: boolean
}[] = [
  {
    name: 'Administrador',
    description: 'Control total: proyectos, tareas, miembros, roles y ajustes de la organización.',
    permissions: [...ALL_PERMISSIONS],
    colorSeed: 0,
    isSystem: true,
  },
  {
    name: 'Gestor de proyecto',
    description: 'Crea y gestiona proyectos y tareas. Puede dar de alta miembros.',
    permissions: [
      'project:create',
      'project:update',
      'project:delete',
      'story:create',
      'story:update',
      'story:delete',
      'task:create',
      'task:update',
      'task:move',
      'task:assign',
      'task:delete',
      'comment:create',
      'comment:delete',
      'attachment:upload',
      'attachment:delete',
      'member:invite',
    ],
    colorSeed: 1,
    isSystem: false,
  },
  {
    name: 'Desarrollador',
    description: 'Crea y actualiza tareas, las mueve en el tablero y comenta.',
    permissions: [
      'task:create',
      'task:update',
      'task:move',
      'task:assign',
      'comment:create',
      'attachment:upload',
    ],
    colorSeed: 2,
    isSystem: false,
  },
  {
    name: 'Observador',
    description: 'Solo lectura. No puede modificar nada.',
    permissions: [],
    colorSeed: 3,
    isSystem: false,
  },
]

/// Rol que se propone a quien pide entrar por su cuenta, mientras espera
/// aprobación. No concede nada: la membresía está PENDING.
export const DEFAULT_JOIN_ROLE = 'Desarrollador'

/// Resumen legible de lo que abarca un rol, para listarlo sin enumerar los 16
/// permisos uno a uno.
export function summarizePermissions(permissions: readonly string[]): string {
  if (permissions.length === 0) return 'Solo lectura'
  if (permissions.length === ALL_PERMISSIONS.length) return 'Control total'

  const groups = PERMISSION_CATALOG.filter((g) =>
    g.items.some((i) => permissions.includes(i.key)),
  ).map((g) => g.group.toLowerCase())

  return `Puede en ${groups.join(', ')}`
}
