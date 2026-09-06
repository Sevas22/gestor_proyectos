/// Límite por archivo.
///
/// Cuatro megas, y el número no es arbitrario: **Vercel corta el cuerpo de
/// cualquier petición a una función en 4,5 MB** y devuelve un error 413
/// (FUNCTION_PAYLOAD_TOO_LARGE). Es un límite de la plataforma, no de Next, así
/// que `serverActions.bodySizeLimit` no lo puede levantar. El medio mega que
/// queda es margen para lo que añade multipart/form-data y para los demás
/// campos del formulario.
///
/// Además, los adjuntos se guardan en la propia base de datos, así que cada
/// megabyte cuenta contra la cuota de Neon (0,5 GB en el plan gratuito).
///
/// Para archivos mayores no basta con subir este número: hay que sacar los
/// bytes de la petición, subiéndolos directamente a un almacenamiento como
/// Vercel Blob o S3 desde el navegador.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

/// Cuántos archivos se pueden elegir de una vez.
///
/// No es un límite del servidor: cada archivo viaja en su **propia** petición
/// precisamente para no sumar tamaños y chocar contra los 4,5 MB. Esto solo
/// evita que alguien seleccione doscientos y se quede mirando la pantalla.
export const MAX_FILES_PER_BATCH = 10

/// Tipos que se aceptan, con la extensión que les corresponde.
///
/// Es una lista blanca y no una negra a propósito: lo que no está, no entra.
/// Un `<input type="file">` no valida nada — el `accept` es solo una sugerencia
/// para el diálogo del sistema — así que la comprobación real está en el
/// servidor, en `validateAttachment`.
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
  'text/markdown': 'MD',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/zip': 'ZIP',
}

/// Lo que se le pasa al atributo `accept` del input, solo para que el diálogo
/// del sistema filtre. No es una medida de seguridad.
export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_MIME_TYPES).join(',')

/// Etiqueta corta del tipo, para mostrar junto al nombre del archivo.
export function fileKindLabel(mimeType: string) {
  return ALLOWED_MIME_TYPES[mimeType] ?? 'Archivo'
}

/// «1,4 MB». Redondea a una decimal porque el tamaño exacto no le importa a
/// nadie mirando una lista.
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/// Limpia el nombre antes de guardarlo y de devolverlo en la cabecera de
/// descarga.
///
/// Quita rutas (`../../etc/passwd`), caracteres de control y comillas: el nombre
/// acaba dentro de `Content-Disposition`, donde una comilla sin escapar permite
/// inyectar directivas en la cabecera.
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'archivo'
  const limpio = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\]/g, '')
    .replace(/^\.+/, '')
    .trim()
  return limpio.slice(0, 120) || 'archivo'
}

export type AttachmentValidation =
  | { ok: true; filename: string; mimeType: string; size: number }
  | { ok: false; message: string }

/// Comprueba un archivo antes de guardarlo. Se ejecuta en el servidor: el
/// navegador no es de fiar ni para el tipo ni para el tamaño.
export function validateAttachment(file: File): AttachmentValidation {
  if (file.size === 0) {
    return { ok: false, message: 'El archivo está vacío.' }
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      message: `El archivo pesa ${formatBytes(file.size)} y el máximo son ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
    }
  }
  if (!ALLOWED_MIME_TYPES[file.type]) {
    return {
      ok: false,
      message: `No se admiten archivos de tipo «${file.type || 'desconocido'}». Se aceptan PDF, imágenes, documentos de Office, texto y ZIP.`,
    }
  }
  return {
    ok: true,
    filename: sanitizeFilename(file.name),
    mimeType: file.type,
    size: file.size,
  }
}
