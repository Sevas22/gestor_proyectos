import { PrismaClient, Priority, Role, TaskStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Datos de demostración: una organización con cinco personas, cuatro proyectos y
// un puñado de tareas repartidas por el tablero, para poder ver la aplicación
// funcionando sin tener que teclear todo a mano.
//
// Es idempotente: se puede ejecutar varias veces sin duplicar nada.

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'demo12345'

const PEOPLE = [
  { email: 'ana@nucleus.test', name: 'Ana Martínez', role: Role.ADMIN, avatarSeed: 0 },
  { email: 'lucia@nucleus.test', name: 'Lucía Ramírez', role: Role.MANAGER, avatarSeed: 1 },
  { email: 'carlos@nucleus.test', name: 'Carlos Gómez', role: Role.DEVELOPER, avatarSeed: 2 },
  { email: 'nadia@nucleus.test', name: 'Nadia Suárez', role: Role.DEVELOPER, avatarSeed: 3 },
  { email: 'tomas@nucleus.test', name: 'Tomás Vega', role: Role.VIEWER, avatarSeed: 4 },
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
  assignee: number | null
  dueInDays: number | null
}[] = [
  { project: 'WEB', title: 'Rediseñar el flujo de alta', description: 'Reducir de cinco pasos a dos. Validar el correo antes de pedir la contraseña.', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assignee: 0, dueInDays: 6 },
  { project: 'WEB', title: 'Estados vacíos del panel', description: 'Cada lista vacía debe decir qué hacer a continuación, no solo que no hay nada.', status: TaskStatus.TODO, priority: Priority.MEDIUM, assignee: 2, dueInDays: 14 },
  { project: 'WEB', title: 'Pruebas E2E de autenticación', description: 'Cubrir alta, acceso, cierre de sesión y expiración de la cookie.', status: TaskStatus.TODO, priority: Priority.HIGH, assignee: 3, dueInDays: -2 },
  { project: 'WEB', title: 'Migrar tipografía a variable', description: 'Una sola petición en vez de cuatro pesos sueltos.', status: TaskStatus.DONE, priority: Priority.LOW, assignee: 2, dueInDays: null },
  { project: 'WEB', title: 'Accesibilidad del menú lateral', description: 'Navegación por teclado y foco visible en todos los enlaces.', status: TaskStatus.IN_REVIEW, priority: Priority.MEDIUM, assignee: 1, dueInDays: 3 },

  { project: 'API', title: 'Validar permisos por rol', description: 'Cada endpoint de escritura comprueba el rol antes de tocar la base de datos.', status: TaskStatus.IN_REVIEW, priority: Priority.URGENT, assignee: 1, dueInDays: 1 },
  { project: 'API', title: 'Límite de peticiones por IP', description: 'Proteger el endpoint de acceso contra fuerza bruta.', status: TaskStatus.TODO, priority: Priority.HIGH, assignee: null, dueInDays: 10 },
  { project: 'API', title: 'Paginación en el listado de tareas', description: 'Cursor en vez de offset: el offset se degrada con el volumen.', status: TaskStatus.TODO, priority: Priority.MEDIUM, assignee: 3, dueInDays: null },
  { project: 'API', title: 'Registro estructurado', description: 'Salida en JSON con identificador de petición para poder correlacionar.', status: TaskStatus.DONE, priority: Priority.MEDIUM, assignee: 2, dueInDays: null },

  { project: 'MOB', title: 'Pantalla de inicio', description: 'Resumen de tareas asignadas y actividad reciente.', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assignee: 3, dueInDays: 8 },
  { project: 'MOB', title: 'Notificaciones push', description: 'Avisar cuando alguien te asigna una tarea o comenta en la tuya.', status: TaskStatus.TODO, priority: Priority.LOW, assignee: null, dueInDays: null },
  { project: 'MOB', title: 'Modo sin conexión', description: 'Caché local de las tareas propias para consultarlas sin red.', status: TaskStatus.TODO, priority: Priority.LOW, assignee: 2, dueInDays: null },

  { project: 'INF', title: 'Copias de seguridad automáticas', description: 'Volcado diario a almacenamiento externo con retención de 30 días.', status: TaskStatus.DONE, priority: Priority.URGENT, assignee: 1, dueInDays: null },
  { project: 'INF', title: 'Alertas de latencia', description: 'Avisar si el percentil 95 supera los 500 ms durante cinco minutos.', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, assignee: 0, dueInDays: -1 },
  { project: 'INF', title: 'Rotar credenciales de base de datos', description: 'Y documentar el procedimiento para que no dependa de una persona.', status: TaskStatus.TODO, priority: Priority.URGENT, assignee: 0, dueInDays: 2 },
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
        update: { role: person.role },
        create: { userId: user.id, orgId: org.id, role: person.role },
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
      assigneeId: template.assignee === null ? null : users[template.assignee].id,
      createdById: users[0].id,
    }

    const task = existing
      ? await prisma.task.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.task.create({ data: { ...data, number }, select: { id: true } })

    taskIds.set(template.title, task.id)
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

  const taskCount = await prisma.task.count({ where: { project: { orgId: org.id } } })

  console.log(`
Listo.

  Organización   Acme Cloud
  Proyectos      ${PROJECTS.length}
  Tareas         ${taskCount}
  Personas       ${PEOPLE.length}

Entra con cualquiera de estas cuentas — la contraseña es la misma para todas:

  ${PEOPLE.map((p) => `${p.email.padEnd(24)} ${p.role}`).join('\n  ')}

  Contraseña     ${DEMO_PASSWORD}

Para ver los permisos en acción, entra como tomas@nucleus.test (observador):
no verá ningún botón de crear ni podrá mover tarjetas.
`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
