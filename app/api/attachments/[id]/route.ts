import { NextResponse, type NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getViewer } from '@/lib/dal'

/// Descarga de un archivo adjunto.
///
/// Es un route handler y no una server action porque hay que devolver bytes con
/// sus cabeceras, no un valor serializado.
///
/// Tres cosas que aquí importan más que en el resto de la aplicación:
///
/// 1. **La consulta filtra por orgId.** Conocer el id de un adjunto no basta
///    para descargarlo: hay que pertenecer a la organización de su tarea.
/// 2. **`Content-Disposition: attachment`.** Fuerza la descarga en vez de
///    mostrarlo en el navegador. Sin esto, subir un SVG o un HTML con
///    JavaScript dentro y pasarle el enlace a alguien sería un XSS almacenado
///    servido desde el propio dominio, con la cookie de sesión a mano.
/// 3. **`X-Content-Type-Options: nosniff`.** Impide que el navegador ignore el
///    tipo declarado y adivine otro mirando el contenido.
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  const viewer = await getViewer()
  if (!viewer) {
    return new NextResponse('No autorizado', { status: 401 })
  }

  const attachment = await prisma.attachment.findFirst({
    where: { id, task: { project: { orgId: viewer.orgId } } },
    select: { filename: true, mimeType: true, size: true, data: true },
  })

  // Mismo criterio que en el resto: si no es tuyo, no existe. Distinguir entre
  // «no existe» y «no puedes» revelaría qué archivos hay en otras
  // organizaciones.
  if (!attachment) {
    return new NextResponse('No encontrado', { status: 404 })
  }

  // El nombre va dos veces: `filename` en ASCII para navegadores antiguos y
  // `filename*` codificado para los acentos y las eñes.
  const asciiName = attachment.filename.replace(/[^\x20-\x7e]/g, '_')
  const utf8Name = encodeURIComponent(attachment.filename)

  return new NextResponse(new Uint8Array(attachment.data), {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(attachment.size),
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      'X-Content-Type-Options': 'nosniff',
      // Los adjuntos son privados: que no queden en caches compartidas.
      'Cache-Control': 'private, no-store',
    },
  })
}
