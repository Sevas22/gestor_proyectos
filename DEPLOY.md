# Despliegue

La aplicación es un Next.js 16 estándar con Prisma y Postgres. Funciona en
cualquier plataforma que ejecute Node.js 20.9+; los ejemplos usan Vercel porque
es lo más directo para Next.js.

## Variables de entorno

Son tres. Sin ellas la aplicación no arranca.

| Variable | Qué es | De dónde sale |
|---|---|---|
| `DATABASE_URL` | Conexión que usa la aplicación en marcha | Neon → *Connection string* → **la que contiene `-pooler`** |
| `DIRECT_URL` | Conexión que usan las migraciones | La misma cadena **sin** `-pooler` |
| `SESSION_SECRET` | Clave con la que se firman las cookies de sesión | La generas tú (ver abajo) |

### Sobre las dos cadenas de Neon

No son intercambiables y es el error más fácil de cometer:

```
DATABASE_URL   ...@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
                            ^^^^^^^ con pooler
DIRECT_URL     ...@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
                            sin pooler
```

La primera pasa por PgBouncer, que reparte conexiones entre muchas peticiones —
justo lo que necesita una aplicación web sin servidor. La segunda es una
conexión directa, que es lo que exigen las migraciones: PgBouncer no soporta las
sentencias preparadas que usa Prisma para migrar.

### Generar `SESSION_SECRET`

**No reutilices la de desarrollo.** Genera una distinta para producción:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Si esta clave cambia, todas las sesiones abiertas se invalidan y la gente tiene
que volver a entrar. No es grave, pero conviene saberlo.

## Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa el repositorio
   `Sevas22/gestor_proyectos`.
2. Vercel detecta Next.js solo. No hay que tocar el comando de compilación: el
   `build` del proyecto ya ejecuta `prisma generate` antes que `next build`, que
   es obligatorio porque Vercel cachea `node_modules` entre despliegues y el
   cliente de Prisma hay que regenerarlo en cada uno.
3. En **Environment Variables**, añade las tres de la tabla. Márcalas para
   *Production*, *Preview* y *Development*.
4. Despliega.

### Las migraciones

La base de datos ya tiene las tablas creadas, así que el primer despliegue
funciona sin más. Cuando cambies `schema.prisma`, aplica la migración antes de
desplegar:

```bash
pnpm db:migrate
```

Eso crea el archivo de migración y lo aplica. Súbelo al repositorio y despliega.
En un servidor ya existente, para aplicar migraciones pendientes sin crear
ninguna nueva:

```bash
pnpm db:deploy
```

> Se puede meter `prisma migrate deploy` en el comando de compilación de Vercel,
> pero entonces un fallo de migración rompe el despliegue entero y deja la
> aplicación anterior servida con un esquema a medias. Es preferible aplicarlas
> a mano y saber cuándo pasan.

## Antes de abrirlo al público

Dos cosas que en desarrollo no importan y en producción sí:

- **Las cuentas de demostración comparten la contraseña `demo12345`.** Cualquiera
  que llegue a la URL puede entrar y modificar los datos. Antes de compartir el
  enlace, o borras los datos de demostración, o cambias esas contraseñas.
  Para empezar de cero: `pnpm db:reset` y te registras tú.
- **Rota la contraseña de la base de datos** si en algún momento la cadena de
  conexión ha estado en un sitio que no controlas: chat, correo, captura de
  pantalla. Neon → *Roles* → *Reset password*, y actualizas las dos variables.

## Desplegar en otro sitio

No hay nada atado a Vercel. En cualquier servidor con Node:

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm build
```

```bash
pnpm start
```

El servidor escucha en el puerto 3000, o en el que indique la variable `PORT`.
Necesita las mismas tres variables de entorno.

Un detalle si lo sirves por HTTP plano detrás de un proxy: la cookie de sesión
lleva la marca `Secure` cuando `NODE_ENV=production`
([`lib/session-cookie.ts`](lib/session-cookie.ts)), así que el navegador solo la
envía por HTTPS. En `localhost` funciona igualmente porque los navegadores lo
consideran origen seguro, pero en un dominio real sin certificado no habría
forma de iniciar sesión.
