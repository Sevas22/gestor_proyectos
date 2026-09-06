import { PrismaClient, Priority, TaskStatus } from '@prisma/client'
import { DEFAULT_ROLES } from '../lib/permissions'
import bcrypt from 'bcryptjs'

// Datos de demostración: una organización con cinco personas, cuatro proyectos y
// un puñado de tareas repartidas por el tablero, para poder ver la aplicación
// funcionando sin tener que teclear todo a mano.
//
// Es idempotente: se puede ejecutar varias veces sin duplicar nada.

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'demo12345'

const PEOPLE = [
  { email: 'ana@nucleus.test', name: 'Ana Martínez', roleName: 'Administrador', avatarSeed: 0 },
  { email: 'lucia@nucleus.test', name: 'Lucía Ramírez', roleName: 'Gestor de proyecto', avatarSeed: 1 },
  { email: 'carlos@nucleus.test', name: 'Carlos Gómez', roleName: 'Desarrollador', avatarSeed: 2 },
  { email: 'nadia@nucleus.test', name: 'Nadia Suárez', roleName: 'Desarrollador', avatarSeed: 3 },
  { email: 'tomas@nucleus.test', name: 'Tomás Vega', roleName: 'Observador', avatarSeed: 4 },
]

const PROJECTS = [
  {
    key: 'WEB',
    name: 'Portal web',
    description: 'Sitio público y área de cliente. Rediseño del flujo de alta y del panel.',
    colorSeed: 0,
    dueDate: daysFromNow(45),
  },
  {
    key: 'API',
    name: 'Core API',
    description: 'Servicios internos: autenticación, permisos y facturación.',
    colorSeed: 1,
    dueDate: daysFromNow(70),
  },
  {
    key: 'MOB',
    name: 'App móvil',
    description: 'Aplicación iOS y Android. Primera versión centrada en consulta.',
    colorSeed: 2,
    dueDate: null,
  },
  {
    key: 'INF',
    name: 'Infraestructura',
    description: 'Despliegues, observabilidad y copias de seguridad.',
    colorSeed: 3,
    dueDate: daysFromNow(-5),
  },
]

/// Plantilla de tareas. `assignee` es el índice dentro de PEOPLE.
const TASKS: {
  project: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  /// Índices dentro de PEOPLE. Varias personas pueden llevar la misma tarea.
  assignees: number[]
  dueInDays: number | null
}[] = [
  { project: 'WEB', title: 'Rediseñar el flujo de alta', description: 'Reducir de cinco pasos a dos. Validar el correo antes de pedir la contraseña.', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assignees: [0], dueInDays: 6 },
  { project: 'WEB', title: 'Estados vacíos del panel', description: 'Cada lista vacía debe decir qué hacer a continuación, no solo que no hay nada.', status: TaskStatus.TODO, priority: Priority.MEDIUM, assignees: [2], dueInDays: 14 },
  { project: 'WEB', title: 'Pruebas E2E de autenticación', description: 'Cubrir alta, acceso, cierre de sesión y expiración de la cookie.', status: TaskStatus.TODO, priority: Priority.HIGH, assignees: [3, 2], dueInDays: -2 },
  { project: 'WEB', title: 'Migrar tipografía a variable', description: 'Una sola petición en vez de cuatro pesos sueltos.', status: TaskStatus.DONE, priority: Priority.LOW, assignees: [2], dueInDays: null },
  { project: 'WEB', title: 'Accesibilidad del menú lateral', description: 'Navegación por teclado y foco visible en todos los enlaces.', status: TaskStatus.IN_REVIEW, priority: Priority.MEDIUM, assignees: [1], dueInDays: 3 },

  { project: 'API', title: 'Validar permisos por rol', description: 'Cada endpoint de escritura comprueba el rol antes de tocar la base de datos.', status: TaskStatus.IN_REVIEW, priority: Priority.URGENT, assignees: [1, 0, 3], dueInDays: 1 },
  { project: 'API', title: 'Límite de peticiones por IP', description: 'Proteger el endpoint de acceso contra fuerza bruta.', status: TaskStatus.TODO, priority: Priority.HIGH, assignees: [], dueInDays: 10 },
  { project: 'API', title: 'Paginación en el listado de tareas', description: 'Cursor en vez de offset: el offset se degrada con el volumen.', status: TaskStatus.TODO, priority: Priority.MEDIUM, assignees: [3], dueInDays: null },
  { project: 'API', title: 'Registro estructurado', description: 'Salida en JSON con identificador de petición para poder correlacionar.', status: TaskStatus.DONE, priority: Priority.MEDIUM, assignees: [2], dueInDays: null },

  { project: 'MOB', title: 'Pantalla de inicio', description: 'Resumen de tareas asignadas y actividad reciente.', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assignees: [3], dueInDays: 8 },
  { project: 'MOB', title: 'Notificaciones push', description: 'Avisar cuando alguien te asigna una tarea o comenta en la tuya.', status: TaskStatus.TODO, priority: Priority.LOW, assignees: [], dueInDays: null },
  { project: 'MOB', title: 'Modo sin conexión', description: 'Caché local de las tareas propias para consultarlas sin red.', status: TaskStatus.TODO, priority: Priority.LOW, assignees: [2], dueInDays: null },

  { project: 'INF', title: 'Copias de seguridad automáticas', description: 'Volcado diario a almacenamiento externo con retención de 30 días.', status: TaskStatus.DONE, priority: Priority.URGENT, assignees: [1], dueInDays: null },
  { project: 'INF', title: 'Alertas de latencia', description: 'Avisar si el percentil 95 supera los 500 ms durante cinco minutos.', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assignees: [0], dueInDays: -1 },
  { project: 'INF', title: 'Rotar credenciales de base de datos', description: 'Y documentar el procedimiento para que no dependa de una persona.', status: TaskStatus.TODO, priority: Priority.URGENT, assignees: [0], dueInDays: 2 },

  // Backlog: trabajo identificado pero todavía sin comprometer. No sale en el
  // tablero ni cuenta en el progreso del proyecto.
  { project: 'WEB', title: 'Buscador global con atajo de teclado', description: 'Cmd+K para saltar a cualquier proyecto o tarea sin usar el ratón.', status: TaskStatus.BACKLOG, priority: Priority.MEDIUM, assignees: [], dueInDays: null },
  { project: 'WEB', title: 'Exportar el tablero a CSV', description: 'Lo pidió administración para los informes mensuales.', status: TaskStatus.BACKLOG, priority: Priority.LOW, assignees: [], dueInDays: null },
  { project: 'API', title: 'Webhooks de eventos de tarea', description: 'Avisar a sistemas externos cuando una tarea cambia de estado.', status: TaskStatus.BACKLOG, priority: Priority.HIGH, assignees: [], dueInDays: null },
  { project: 'API', title: 'Caché de las consultas del panel', description: 'El resumen hace siete consultas en cada carga.', status: TaskStatus.BACKLOG, priority: Priority.MEDIUM, assignees: [3], dueInDays: null },
  { project: 'MOB', title: 'Widget para la pantalla de inicio', description: 'Ver las tareas del día sin abrir la aplicación.', status: TaskStatus.BACKLOG, priority: Priority.LOW, assignees: [], dueInDays: null },
]

/// Historias de usuario del cronograma. `tasks` son títulos de tareas de TASKS
/// que cuelgan de ella.
const STORIES: {
  project: string
  title: string
  asA: string
  iWant: string
  soThat: string
  description: string
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE'
  startsInDays: number | null
  durationDays: number
  tasks: string[]
}[] = [
  {
    project: 'WEB',
    title: 'Alta de cuenta en dos pasos',
    asA: 'persona que llega por primera vez',
    iWant: 'crear mi cuenta sin rellenar cinco pantallas',
    soThat: 'pueda empezar a usar el producto el mismo día',
    description:
      '- El correo se valida antes de pedir la contraseña\n- No más de dos pantallas hasta entrar\n- Se puede volver atrás sin perder lo escrito',
    status: 'IN_PROGRESS',
    startsInDays: -4,
    durationDays: 14,
    tasks: ['Rediseñar el flujo de alta', 'Pruebas E2E de autenticación'],
  },
  {
    project: 'WEB',
    title: 'El panel se entiende estando vacío',
    asA: 'persona que acaba de crear su equipo',
    iWant: 'que cada lista vacía me diga qué hacer',
    soThat: 'no me quede mirando una pantalla en blanco',
    description: '- Ninguna lista vacía se limita a decir que no hay nada',
    status: 'PLANNED',
    startsInDays: 12,
    durationDays: 8,
    tasks: ['Estados vacíos del panel', 'Accesibilidad del menú lateral'],
  },
  {
    project: 'API',
    title: 'Cada quien toca solo lo suyo',
    asA: 'responsable del equipo',
    iWant: 'que los permisos se apliquen en el servidor',
    soThat: 'nadie pueda saltárselos llamando a la API directamente',
    description:
      '- Toda escritura comprueba el permiso antes de tocar la base\n- Un observador no modifica nada ni por API',
    status: 'DONE',
    startsInDays: -20,
    durationDays: 16,
    tasks: ['Validar permisos por rol', 'Registro estructurado'],
  },
  {
    project: 'API',
    title: 'La API aguanta el volumen',
    asA: 'equipo de operaciones',
    iWant: 'paginación y límite de peticiones',
    soThat: 'el servicio no se degrade cuando crezcan los datos',
    description: '- El listado pagina por cursor\n- El acceso limita intentos por IP',
    status: 'PLANNED',
    startsInDays: 6,
    durationDays: 21,
    tasks: ['Paginación en el listado de tareas', 'Límite de peticiones por IP'],
  },
  {
    project: 'MOB',
    title: 'Consultar el trabajo desde el móvil',
    asA: 'persona del equipo fuera de la oficina',
    iWant: 'ver mis tareas del día en el teléfono',
    soThat: 'sepa qué me toca sin abrir el portátil',
    description: '- Pantalla de inicio con lo asignado y la actividad reciente',
    status: 'IN_PROGRESS',
    startsInDays: 2,
    durationDays: 18,
    tasks: ['Pantalla de inicio'],
  },
  {
    project: 'INF',
    title: 'Enterarse antes que el cliente',
    asA: 'responsable de infraestructura',
    iWant: 'alertas de latencia y copias automáticas',
    soThat: 'un problema no se descubra por una queja',
    description: '- Aviso si el percentil 95 pasa de 500 ms cinco minutos\n- Copia diaria con 30 días de retención',
    status: 'IN_PROGRESS',
    startsInDays: -10,
    durationDays: 24,
    tasks: ['Alertas de latencia', 'Copias de seguridad automáticas'],
  },
  {
    project: 'MOB',
    title: 'Avisos cuando algo me toca',
    asA: 'persona del equipo',
    iWant: 'que me avisen si me asignan una tarea',
    soThat: 'no tenga que entrar a comprobarlo',
    description: '',
    status: 'PLANNED',
    startsInDays: null,
    durationDays: 0,
    tasks: ['Notificaciones push'],
  },
]

const COMMENTS = [
  { taskTitle: 'Validar permisos por rol', author: 0, body: 'Ojo con las server actions: se pueden llamar por POST sin pasar por la interfaz, así que la comprobación tiene que estar dentro de la acción, no solo en el componente.' },
  { taskTitle: 'Validar permisos por rol', author: 1, body: 'Hecho. La matriz está en lib/permissions.ts y cada acción llama a requirePermission antes de escribir.' },
  { taskTitle: 'Rediseñar el flujo de alta', author: 2, body: 'El copy de la pantalla de confirmación necesita una vuelta antes de pasar a QA.' },
  { taskTitle: 'Pruebas E2E de autenticación', author: 3, body: 'Esta se pasó de fecha. ¿La movemos al siguiente ciclo o la priorizamos?' },
]

function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(12, 0, 0, 0)
  return date
}

async function main() {
  console.log('Sembrando datos de demostración…')

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12)

  const org = await prisma.organization.upsert({
    where: { slug: 'acme-cloud' },
    update: {},
    create: { name: 'Acme Cloud', slug: 'acme-cloud' },
  })

  // Los roles por defecto, y un quinto propio para enseñar que se pueden crear.
  const rolesDemo = [
    ...DEFAULT_ROLES,
    {
      name: 'QA',
      description: 'Revisa y mueve tareas en el tablero, pero no crea ni borra proyectos.',
      permissions: ['task:update', 'task:move', 'comment:create'],
      colorSeed: 4,
      isSystem: false,
    },
  ]

  const roles = new Map<string, string>()
  for (const role of rolesDemo) {
    const created = await prisma.teamRole.upsert({
      where: { orgId_name: { orgId: org.id, name: role.name } },
      update: {
        description: role.description,
        permissions: role.permissions,
        colorSeed: role.colorSeed,
      },
      create: { ...role, orgId: org.id },
      select: { id: true, name: true },
    })
    roles.set(created.name, created.id)
  }

  const users = await Promise.all(
    PEOPLE.map(async (person) => {
      const user = await prisma.user.upsert({
        where: { email: person.email },
        update: { name: person.name, avatarSeed: person.avatarSeed },
        create: {
          email: person.email,
          name: person.name,
          avatarSeed: person.avatarSeed,
          passwordHash,
        },
      })
      await prisma.membership.upsert({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
        update: { roleId: roles.get(person.roleName)!, status: 'ACTIVE' },
        // status explícito: el valor por defecto del esquema es PENDING, así que
        // omitirlo dejaría a todo el equipo de demostración esperando aprobación.
        create: {
          userId: user.id,
          orgId: org.id,
          roleId: roles.get(person.roleName)!,
          status: 'ACTIVE',
        },
      })
      return user
    }),
  )

  const projects = new Map<string, string>()
  for (const project of PROJECTS) {
    const created = await prisma.project.upsert({
      where: { orgId_key: { orgId: org.id, key: project.key } },
      update: { name: project.name, description: project.description, colorSeed: project.colorSeed },
      create: { ...project, orgId: org.id },
    })
    projects.set(project.key, created.id)
  }

  // Las tareas se numeran por proyecto, así que el contador se lleva aparte.
  const counters = new Map<string, number>()
  const taskIds = new Map<string, string>()

  for (const template of TASKS) {
    const projectId = projects.get(template.project)!
    const number = (counters.get(template.project) ?? 0) + 1
    counters.set(template.project, number)

    const existing = await prisma.task.findUnique({
      where: { projectId_number: { projectId, number } },
      select: { id: true },
    })

    const data = {
      title: template.title,
      description: template.description,
      status: template.status,
      priority: template.priority,
      position: number,
      dueDate: template.dueInDays === null ? null : daysFromNow(template.dueInDays),
      projectId,
      assignees: { set: template.assignees.map((i) => ({ id: users[i].id })) },
      createdById: users[0].id,
    }

    // Al crear se usa `connect` y al actualizar `set`: son la misma intención,
    // pero `set` sobre una fila que aún no existe no tiene sentido.
    const { assignees: _sinUsar, ...datosSinResponsables } = data

    const task = existing
      ? await prisma.task.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.task.create({
          // `set` no vale al crear: la tarea todavía no existe, así que se conecta.
          data: {
            ...datosSinResponsables,
            number,
            assignees: { connect: template.assignees.map((i) => ({ id: users[i].id })) },
          },
          select: { id: true },
        })

    taskIds.set(template.title, task.id)
  }

  // Historias del cronograma. Se crean después de las tareas para poder
  // engancharlas por título.
  const contadorHistorias = new Map<string, number>()
  for (const plantilla of STORIES) {
    const projectId = projects.get(plantilla.project)!
    const number = (contadorHistorias.get(plantilla.project) ?? 0) + 1
    contadorHistorias.set(plantilla.project, number)

    const fechas =
      plantilla.startsInDays === null
        ? { startDate: null, endDate: null }
        : {
            startDate: daysFromNow(plantilla.startsInDays),
            endDate: daysFromNow(plantilla.startsInDays + plantilla.durationDays),
          }

    const datos = {
      title: plantilla.title,
      asA: plantilla.asA,
      iWant: plantilla.iWant,
      soThat: plantilla.soThat,
      description: plantilla.description,
      status: plantilla.status,
      ...fechas,
      projectId,
      createdById: users[0].id,
    }

    const existente = await prisma.story.findUnique({
      where: { projectId_number: { projectId, number } },
      select: { id: true },
    })
    const story = existente
      ? await prisma.story.update({ where: { id: existente.id }, data: datos, select: { id: true } })
      : await prisma.story.create({ data: { ...datos, number }, select: { id: true } })

    // Enganchar sus tareas por título dentro del mismo proyecto.
    await prisma.task.updateMany({
      where: { projectId, title: { in: plantilla.tasks } },
      data: { storyId: story.id },
    })
  }

  // Los comentarios no tienen clave natural, así que se limpian y se recrean.
  await prisma.comment.deleteMany({ where: { task: { project: { orgId: org.id } } } })
  for (const comment of COMMENTS) {
    const taskId = taskIds.get(comment.taskTitle)
    if (!taskId) continue
    await prisma.comment.create({
      data: { taskId, authorId: users[comment.author].id, body: comment.body },
    })
  }

  await prisma.activity.deleteMany({ where: { orgId: org.id } })
  await prisma.activity.createMany({
    data: [
      { type: 'TASK_STATUS_CHANGED', summary: 'movió API-1 a En revisión', actorId: users[1].id, orgId: org.id },
      { type: 'COMMENT_CREATED', summary: 'comentó en WEB-1', actorId: users[2].id, orgId: org.id },
      { type: 'TASK_CREATED', summary: 'creó INF-3: Rotar credenciales de base de datos', actorId: users[0].id, orgId: org.id },
      { type: 'TASK_STATUS_CHANGED', summary: 'movió INF-1 a Completada', actorId: users[1].id, orgId: org.id },
      { type: 'MEMBER_JOINED', summary: 'añadió a Nadia Suárez como Desarrollador', actorId: users[0].id, orgId: org.id },
    ],
  })

  // Una solicitud sin resolver, para que se vea la bandeja de aprobación.
  const solicitante = await prisma.user.upsert({
    where: { email: 'nuevo@nucleus.test' },
    update: { name: 'Pablo Herrera' },
    create: {
      email: 'nuevo@nucleus.test',
      name: 'Pablo Herrera',
      passwordHash,
      avatarSeed: 5,
    },
  })
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: solicitante.id, orgId: org.id } },
    update: { status: 'PENDING', roleId: roles.get('Desarrollador')! },
    create: {
      userId: solicitante.id,
      orgId: org.id,
      roleId: roles.get('Desarrollador')!,
      status: 'PENDING',
    },
  })

  const taskCount = await prisma.task.count({ where: { project: { orgId: org.id } } })

  console.log(`
Listo.

  Organización   Acme Cloud
  Proyectos      ${PROJECTS.length}
  Tareas         ${taskCount}
  Personas       ${PEOPLE.length}

Entra con cualquiera de estas cuentas — la contraseña es la misma para todas:

  ${PEOPLE.map((p) => `${p.email.padEnd(24)} ${p.roleName}`).join('\n  ')}

  Contraseña     ${DEMO_PASSWORD}

Código de este equipo: ${org.slug}
Con él, cualquiera puede pedir entrar desde la pantalla de registro.

Para ver los permisos en acción, entra como tomas@nucleus.test (observador):
no verá ningún botón de crear ni podrá mover tarjetas.

Hay además una solicitud sin resolver (Pablo Herrera). Entra como
ana@nucleus.test y la verás en Equipo, esperando que le asignes un rol.

Cada proyecto tiene su pestaña de Backlog junto al tablero, con trabajo
identificado pero sin comprometer, y una de Cronograma con las historias de
usuario colocadas en una línea de tiempo.
`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
