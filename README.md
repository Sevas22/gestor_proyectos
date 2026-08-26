# Nucleus

Gestor de proyectos para un equipo de trabajo. Proyectos, tablero Kanban,
comentarios, roles con permisos reales y un registro de actividad.

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma · Postgres (Neon)

## Puesta en marcha

Requiere Node.js 20.9 o superior.

### 1. Dependencias

```bash
pnpm install
```

### 2. Base de datos en Neon

Prisma y Neon no son alternativas: **Prisma** es el ORM (define el esquema y
genera el cliente) y **Neon** es el Postgres alojado que le da la conexión.

1. Crea una cuenta y un proyecto en [neon.com](https://neon.com).
2. En el panel del proyecto, abre **Connection string** y selecciona **Prisma**.
3. Neon muestra dos cadenas. Copia cada una en su variable de `.env`:
   - la que contiene `-pooler` → `DATABASE_URL` (la que usa la aplicación)
   - la que **no** contiene `-pooler` → `DIRECT_URL` (la que usan las migraciones)

```bash
cp .env.example .env
```

Genera además la clave con la que se firman las sesiones:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

y pégala en `SESSION_SECRET`.

> Sirve cualquier Postgres, no solo Neon. Si usas otro, pon la misma cadena en
> las dos variables.

> **La aplicación lee `DATABASE_URL` al construir el cliente de Prisma.** Si el
> servidor de desarrollo ya estaba corriendo cuando rellenaste `.env`, reinícialo
> — si no, se queda con la cadena vacía y el síntoma es un error 500 confuso al
> iniciar sesión.

### 3. Crear las tablas y arrancar

```bash
pnpm db:deploy
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

La aplicación queda en http://localhost:3000.

### Cuentas de demostración

Tras `pnpm db:seed`, todas comparten la contraseña `demo12345`:

| Correo | Rol |
|---|---|
| `ana@nucleus.test` | Administrador |
| `lucia@nucleus.test` | Gestor de proyecto |
| `carlos@nucleus.test` | Desarrollador |
| `tomas@nucleus.test` | Observador |

Para ver los permisos en acción, entra como `tomas@nucleus.test`: no verá ningún
botón de crear ni podrá arrastrar tarjetas.

## Qué hace

- **Organizaciones.** Cada equipo es una organización y todo cuelga de ella.
  Registrarse crea la cuenta y la organización a la vez, y quien la crea queda
  como administrador.
- **Proyectos.** Con clave corta (`WEB`, `API`), color, estado y fecha de
  entrega. Las tareas se numeran por proyecto: `WEB-1`, `WEB-2`.
- **Tablero Kanban.** Cuatro columnas con arrastrar y soltar. El movimiento se
  pinta al instante y se confirma contra el servidor; si falla, la tarjeta vuelve
  sola a su sitio.
- **Tareas.** Título, descripción, responsable, prioridad, fecha límite y
  comentarios.
- **Equipo y roles.** Cuatro roles con permisos que el servidor aplica de verdad.
- **Actividad.** Cada cambio deja un registro con quién, qué y cuándo.

## Roles

| Rol | Puede |
|---|---|
| Administrador | Todo, incluidos miembros y ajustes de la organización |
| Gestor de proyecto | Crear y borrar proyectos y tareas, invitar miembros |
| Desarrollador | Crear y editar tareas, moverlas en el tablero, comentar |
| Observador | Solo lectura |

## Seguridad

La autorización vive en **dos capas, y solo la segunda cuenta**:

1. `proxy.ts` (el antiguo `middleware.ts`; en Next.js 16 cambió de nombre) hace
   una comprobación optimista sobre la cookie para no pintar pantallas que el
   usuario no puede ver. No consulta la base de datos porque se ejecuta en cada
   navegación, incluidas las precargadas.
2. `lib/dal.ts` es la que protege los datos. Se ejecuta pegada a la base de
   datos, así que también cubre las server actions — que son alcanzables por
   `POST` directo sin pasar por la interfaz.

Que las dos capas miren cosas distintas tiene una consecuencia que no es obvia:
una cookie con **firma correcta** cuya fila ya no existe (a alguien lo sacaron
del equipo, se reinició la base) haría que el proxy la diera por buena y mandara
al panel, mientras la capa de datos manda a la pantalla de acceso — un bucle
infinito de redirecciones del que el usuario no puede salir ni siquiera para
volver a entrar. Por eso `resolveViewer` distingue **tres** desenlaces y no dos:
sin cookie, cookie huérfana, y sesión buena. La huérfana se manda a
[`/logout`](app/logout/route.ts), un route handler que sí puede borrarla — un
componente de servidor no puede escribir cookies.

Concretamente:

- Las contraseñas se guardan con **bcrypt** (coste 12). Nunca en claro.
- La sesión es un **JWT firmado con HS256** en una cookie `httpOnly`, `sameSite:
  lax` y `secure` en producción.
- Cada mutación llama a `requirePermission(...)` antes de escribir.
- Cada consulta filtra por `orgId`. Un id de otra organización no devuelve
  «prohibido», devuelve «no existe»: así no se puede averiguar qué hay al otro
  lado.
- Al iniciar sesión, un correo que no existe y una contraseña incorrecta dan el
  mismo mensaje y tardan lo mismo, para que no se pueda deducir quién tiene
  cuenta.
- Ocultar un botón en la interfaz **no** es una medida de seguridad; aquí es solo
  cortesía. La comprobación real está siempre en el servidor.

## Estado de verificación

Todo lo anterior se probó contra Postgres real — primero uno local, luego el
Neon de producción (no solo compilando):

- Migración y seed aplicados desde cero; el seed es idempotente.
- Registro, inicio y cierre de sesión.
- Crear proyecto, crear tarea, mover tarjeta entre columnas, comentar, añadir
  miembro. Todo persiste tras recargar y queda anotado en la actividad.
- **Permisos:** con el botón de comentar visible a propósito, un observador
  envió el formulario por el camino normal de React y el servidor respondió
  «No tienes permiso para realizar esta acción (comment:create)». Cero
  escrituras no autorizadas en la base de datos.
- **Aislamiento entre organizaciones:** con sesión de otra organización, un
  proyecto ajeno responde «no existe», y el desplegable de responsables solo
  ofrece a los miembros propios.
- **Último administrador:** el único admin no puede degradarse a sí mismo.
- **Cookie huérfana:** con una sesión firmada correctamente pero cuyo usuario ya
  no existe, la aplicación redirige dos veces, borra la cookie y explica por qué.
  Antes de arreglarlo eran redirecciones infinitas.
- **Sobre el pooler de Neon:** las transacciones interactivas de Prisma
  (`$transaction`, que usa la creación de tareas para numerarlas sin colisiones)
  funcionan sobre la cadena con `-pooler`. No hace falta añadir `pgbouncer=true`.

## Despliegue

Las variables de entorno y los pasos para publicarlo están en
[DEPLOY.md](DEPLOY.md).

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Genera el cliente de Prisma y compila para producción |
| `pnpm typecheck` | Comprueba los tipos sin compilar |
| `pnpm db:deploy` | Aplica las migraciones existentes |
| `pnpm db:migrate` | Crea una migración nueva tras cambiar el esquema |
| `pnpm db:seed` | Carga los datos de demostración |
| `pnpm db:studio` | Abre Prisma Studio para inspeccionar las tablas |
| `pnpm db:reset` | Borra la base de datos y la vuelve a crear |

## Estructura

```
prisma/schema.prisma          modelos y enums
prisma/seed.ts                datos de demostración
proxy.ts                      comprobación optimista de sesión

lib/session.ts                firma y verificación del JWT (sirve en el edge)
lib/session-cookie.ts         lectura y escritura de la cookie
lib/dal.ts                    capa de acceso a datos: sesión y permisos
lib/permissions.ts            matriz de rol → permisos
lib/queries.ts                consultas de lectura, todas filtradas por orgId
lib/validation.ts             esquemas de Zod
lib/format.ts                 etiquetas, colores y fechas en español

app/actions/                  server actions: auth, proyectos, tareas,
                              comentarios y miembros
app/(auth)/                   acceso y registro
app/(app)/                    panel: resumen, proyectos, tareas, equipo, ajustes

components/board/             tablero Kanban, diálogos de tarea, detalle
components/projects/          formulario y borrado de proyectos
components/team/              alta de miembros y fila de miembro
components/ui/                piezas reutilizables: diálogo, campos, avatar
```

## Notas de diseño

- **Los colores se escriben completos, nunca interpolados.** Tailwind busca
  nombres de clase literales en el código, así que `bg-${color}-500` no genera
  ningún CSS. La paleta vive en `lib/format.ts` como cadenas completas.
- **Los filtros van en la URL**, no en el estado del componente: se pueden
  compartir, sobreviven a una recarga y el filtrado lo resuelve la base de datos.
- **El detalle de una tarea es `?task=<id>`**, no estado del cliente. Así lo
  renderiza el servidor con los comentarios frescos y el botón «atrás» cierra el
  panel.
- **La posición en el tablero es un `Float`.** Al soltar una tarjeta entre otras
  dos se le asigna el punto medio, y no hay que reindexar la columna entera.
- **Las fechas sin hora se tratan como locales, nunca como UTC.** `new Date('2026-09-30')`
  se interpreta por especificación como medianoche UTC, así que en Colombia
  (UTC−5) esa fecha se muestra como el día 29. `parseDateOnly` y
  `toDateInputValue` en [`lib/format.ts`](lib/format.ts) hacen la conversión en
  ambos sentidos usando componentes locales. `parseDateOnly` además comprueba
  que la fecha construida sea la pedida, porque el constructor de `Date`
  desborda en silencio: `2026-02-30` se convertiría en el 2 de marzo.
- **La concordancia de singular y plural pasa por `plural()`.** Repetir el
  ternario en cada pantalla es justo lo que produce «1 proyectos activos».

## Pendiente

Cosas que no están y que serían el siguiente paso natural:

- **Invitaciones por correo.** Ahora, al añadir a alguien que no tiene cuenta, se
  crea con una contraseña temporal que se muestra una sola vez para entregarla a
  mano. Con un servidor de correo esto sería un enlace de invitación.
- **Cambio de contraseña** desde ajustes, y recuperación por correo.
- **Sprints y registro de horas.** El modelo de datos los admitiría sin
  romper nada.
- **Pertenecer a varias organizaciones.** El esquema ya lo permite (`Membership`
  es una tabla aparte), pero la interfaz no ofrece todavía un selector para
  cambiar de una a otra.
