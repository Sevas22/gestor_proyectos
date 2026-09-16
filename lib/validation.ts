import { Priority, ProjectStatus, StoryStatus, TaskStatus } from '@prisma/client'
import { parseDateOnly } from '@/lib/format'
import { ALL_PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'

// Los formularios se validan aquí y también en las server actions. La validación
// del cliente es comodidad; la del servidor es la que protege la base de datos.

const trimmed = (max: number) => z.string().trim().max(max)

// El registro tiene dos caminos y el formulario elige uno con el campo `mode`:
//   'create' → nace una organización y quien la crea es su administrador
//   'join'   → se pide entrar a una que ya existe, con su código
// Van en un solo esquema discriminado para que cada camino exija exactamente
// sus campos: pedir el nombre del equipo a quien se está uniendo, o el código a
// quien lo está creando, sería pedir datos que esa persona no tiene.
const credentials = {
  name: trimmed(80).min(2, 'Escribe tu nombre completo.'),
  email: trimmed(160).toLowerCase().pipe(z.email('Ese correo no parece válido.')),
  password: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.').max(200),
  confirmPassword: z.string(),
}

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword

const mismatch = { message: 'Las contraseñas no coinciden.', path: ['confirmPassword'] }

export const registerSchema = z
  .discriminatedUnion('mode', [
    z.object({
      mode: z.literal('create'),
      ...credentials,
      orgName: trimmed(80).min(2, 'Dale un nombre a tu equipo.'),
    }),
    z.object({
      mode: z.literal('join'),
      ...credentials,
      teamCode: trimmed(40)
        .min(2, 'Pide el código a quien administra el equipo.')
        .toLowerCase(),
    }),
  ])
  .refine(passwordsMatch, mismatch)

export const loginSchema = z.object({
  email: trimmed(160).toLowerCase().pipe(z.email('Ese correo no parece válido.')),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

/// Cambio de la propia contraseña. Se pide la actual aunque haya sesión: una
/// sesión abierta en un ordenador ajeno no debería bastar para quedarse con la
/// cuenta.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual.'),
    password: credentials.password,
    confirmPassword: credentials.confirmPassword,
  })
  .refine(passwordsMatch, mismatch)
  .refine((data) => data.password !== data.currentPassword, {
    message: 'La nueva contraseña tiene que ser distinta de la actual.',
    path: ['password'],
  })

export const resetPasswordSchema = z.object({
  membershipId: z.string().min(1),
})

export const projectSchema = z.object({
  name: trimmed(80).min(2, 'El proyecto necesita un nombre.'),
  key: trimmed(8)
    .min(2, 'La clave necesita al menos 2 letras.')
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]*$/, 'Solo letras y números, empezando por una letra. Ej: WEB, API2.'),
  description: trimmed(500).default(''),
  status: z.enum(ProjectStatus).default('ACTIVE'),
  colorSeed: z.coerce.number().int().min(0).max(5).default(0),
  // parseDateOnly interpreta "2026-09-30" como medianoche local, no UTC.
  // El error se emite desde el transform: si solo se comprobara el resultado,
  // una fecha ilegible sería indistinguible de un campo vacío y se guardaría
  // como null sin avisar.
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null
      const parsed = parseDateOnly(value)
      if (!parsed) {
        ctx.addIssue({ code: 'custom', message: 'Fecha inválida.' })
        return z.NEVER
      }
      return parsed
    }),
})

const fechaOpcional = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null
    const parsed = parseDateOnly(value)
    if (!parsed) {
      ctx.addIssue({ code: 'custom', message: 'Fecha inválida.' })
      return z.NEVER
    }
    return parsed
  })

export const storySchema = z
  .object({
    title: trimmed(140).min(3, 'Ponle un título a la historia.'),
    asA: trimmed(80).default(''),
    iWant: trimmed(200).default(''),
    soThat: trimmed(200).default(''),
    description: trimmed(2000).default(''),
    projectId: z.string().min(1, 'Elige un proyecto.'),
    status: z.enum(StoryStatus).default('PLANNED'),
    colorSeed: z.coerce.number().int().min(0).max(5).default(0),
    startDate: fechaOpcional,
    endDate: fechaOpcional,
  })
  // Una barra que acaba antes de empezar no se puede dibujar, y sobre todo no
  // significa nada. Se rechaza aquí en vez de dejar que el cronograma pinte algo
  // absurdo.
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: 'La fecha de fin no puede ser anterior a la de inicio.',
    path: ['endDate'],
  })
  // Media fecha no coloca nada en el cronograma: o las dos, o ninguna.
  .refine((d) => Boolean(d.startDate) === Boolean(d.endDate), {
    message: 'Pon las dos fechas o ninguna: con solo una no se puede programar.',
    path: ['endDate'],
  })

export const taskSchema = z.object({
  title: trimmed(140).min(3, 'Describe la tarea en al menos 3 caracteres.'),
  description: trimmed(2000).default(''),
  projectId: z.string().min(1, 'Elige un proyecto.'),
  status: z.enum(TaskStatus).default('TODO'),
  priority: z.enum(Priority).default('MEDIUM'),
  // Varias personas pueden llevar la misma tarea. Las casillas marcadas llegan
  // repetidas bajo el mismo nombre, así que el formulario manda una lista.
  assigneeIds: z
    .array(z.string().min(1))
    .default([])
    // Marcar dos veces a la misma persona no debería duplicar la asignación.
    .transform((ids) => [...new Set(ids)]),
  // Cadena vacía = suelta, sin historia. El <select> no puede emitir null.
  storyId: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  // parseDateOnly interpreta "2026-09-30" como medianoche local, no UTC.
  // El error se emite desde el transform: si solo se comprobara el resultado,
  // una fecha ilegible sería indistinguible de un campo vacío y se guardaría
  // como null sin avisar.
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null
      const parsed = parseDateOnly(value)
      if (!parsed) {
        ctx.addIssue({ code: 'custom', message: 'Fecha inválida.' })
        return z.NEVER
      }
      return parsed
    }),
})

export const commentSchema = z.object({
  taskId: z.string().min(1),
  body: trimmed(2000).min(1, 'El comentario está vacío.'),
})

export const memberInviteSchema = z.object({
  email: trimmed(160).toLowerCase().pipe(z.email('Ese correo no parece válido.')),
  roleId: z.string().min(1, 'Elige un rol.'),
})

export const memberRoleSchema = z.object({
  membershipId: z.string().min(1),
  roleId: z.string().min(1, 'Elige un rol.'),
})

export const roleSchema = z.object({
  name: trimmed(40).min(2, 'El rol necesita un nombre.'),
  description: trimmed(200).default(''),
  colorSeed: z.coerce.number().int().min(0).max(5).default(0),
  // Se filtra contra el catálogo en vez de rechazar: el formulario puede mandar
  // claves obsoletas si alguien lo dejó abierto durante un despliegue, y eso no
  // debería impedir guardar el resto.
  permissions: z
    .array(z.string())
    .default([])
    .transform((values) =>
      ALL_PERMISSIONS.filter((permission) => values.includes(permission)),
    ),
})

export const orgSchema = z.object({
  name: trimmed(80).min(2, 'La organización necesita un nombre.'),
})

/// Resultado uniforme de las server actions, para que useActionState pinte
/// errores de la misma forma en todos los formularios.
export type ActionState = {
  ok: boolean
  message?: string
  /// Errores por campo, en el formato que devuelve z.flattenError.
  errors?: Record<string, string[] | undefined>
  /// Id de la fila recién creada, cuando el cliente necesita seguir trabajando
  /// con ella. Lo usa el diálogo de tarea para adjuntar archivos a algo que
  /// hasta ese momento no existía.
  createdId?: string
  /// Contraseña temporal recién generada. Va aparte del mensaje para que la
  /// interfaz la pueda enseñar en grande y copiar, en vez de enterrada en una
  /// frase. Vive solo en la respuesta: no se guarda en ningún sitio en claro.
  temporaryPassword?: string
}

export const EMPTY_STATE: ActionState = { ok: false }

/// Traduce un ZodError al formato de ActionState.
export function fieldErrors(error: z.ZodError): ActionState {
  return {
    ok: false,
    message: 'Revisa los campos marcados.',
    errors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
  }
}
