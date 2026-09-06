'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileText, Paperclip, Trash2 } from 'lucide-react'

import { deleteAttachmentAction, uploadAttachmentAction } from '@/app/actions/attachments'
import { EMPTY_STATE } from '@/lib/validation'
import { can, type Permission } from '@/lib/permissions'
import {
  ACCEPT_ATTRIBUTE,
  MAX_ATTACHMENT_BYTES,
  fileKindLabel,
  formatBytes,
  validateAttachment,
} from '@/lib/attachments'
import { relativeTime } from '@/lib/format'
import { FormMessage } from '@/components/ui/primitives'
import { SubmitButton } from '@/components/ui/submit-button'

export type AttachmentSummary = {
  id: string
  filename: string
  mimeType: string
  size: number
  createdAt: Date
  uploadedById: string
  uploadedBy: { id: string; name: string; avatarSeed: number }
}

/// Archivos de una tarea.
///
/// Las descargas van por `/api/attachments/[id]`, que comprueba la sesión y la
/// organización antes de devolver los bytes, y fuerza la descarga en vez de
/// mostrar el archivo en el navegador.
export function AttachmentList({
  taskId,
  attachments,
  permissions,
  viewerId,
}: {
  taskId: string
  attachments: AttachmentSummary[]
  permissions: Permission[]
  viewerId: string
}) {
  const router = useRouter()
  const [uploadState, upload] = useActionState(uploadAttachmentAction, EMPTY_STATE)
  const formRef = useRef<HTMLFormElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!uploadState.ok) return
    formRef.current?.reset()
    setLocalError(null)
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadState])

  /// Valida en cuanto se elige el archivo, antes de enviarlo.
  ///
  /// No es por comodidad: `serverActions.bodySizeLimit` corta la petición en el
  /// framework, antes de que el código llegue a validar nada, y el usuario ve un
  /// error de servidor opaco en vez de «el archivo pesa demasiado». Comprobarlo
  /// aquí evita mandar megabytes que van a rebotar. La validación que protege es
  /// la del servidor; esta solo explica el problema a tiempo.
  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      setLocalError(null)
      return
    }
    const check = validateAttachment(file)
    if (check.ok) {
      setLocalError(null)
      return
    }
    setLocalError(check.message)
    // Se vacía para que no quede un archivo inválido listo para enviarse.
    event.target.value = ''
  }

  const canUpload = can(permissions, 'attachment:upload')
  const canDeleteOthers = can(permissions, 'attachment:delete')

  return (
    <div className="border-t border-border pt-5">
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <Paperclip className="size-3" />
        Archivos ({attachments.length})
      </p>

      {attachments.length === 0 ? (
        <p className="rounded-lg bg-accent/50 px-3 py-4 text-center text-xs text-muted-foreground">
          No hay archivos adjuntos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                <FileText className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.filename}</p>
                <p className="tabular text-[11px] text-muted-foreground">
                  {fileKindLabel(file.mimeType)} · {formatBytes(file.size)} ·{' '}
                  {file.uploadedById === viewerId ? 'tú' : file.uploadedBy.name}{' '}
                  {relativeTime(file.createdAt)}
                </p>
              </div>

              <a
                href={`/api/attachments/${file.id}`}
                // El servidor manda Content-Disposition: attachment, así que
                // esto descarga en vez de abrir. `download` es solo un refuerzo.
                download={file.filename}
                aria-label={`Descargar ${file.filename}`}
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Download className="size-4" />
              </a>

              {(file.uploadedById === viewerId || canDeleteOthers) && (
                <DeleteAttachmentButton id={file.id} filename={file.filename} />
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <form ref={formRef} action={upload} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="taskId" value={taskId} />
          <input
            type="file"
            name="file"
            required
            // `accept` solo filtra el diálogo del sistema; onChange avisa al
            // instante. La validación que protege es la del servidor.
            accept={ACCEPT_ATTRIBUTE}
            onChange={onFileChange}
            aria-label="Archivo a adjuntar"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-2 file:py-1 file:text-xs file:font-semibold file:text-accent-foreground"
          />
          <SubmitButton variant="outline" className="px-3 py-2 text-xs" pendingLabel="Subiendo…">
            <Paperclip className="size-3.5" />
            Adjuntar
          </SubmitButton>
        </form>
      )}

      {canUpload && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Hasta {formatBytes(MAX_ATTACHMENT_BYTES)} por archivo. PDF, imágenes, documentos de
          Office, texto y ZIP.
        </p>
      )}

      {(localError || uploadState.message) && (
        <div className="mt-2">
          <FormMessage ok={!localError && uploadState.ok}>
            {localError ?? uploadState.message}
          </FormMessage>
        </div>
      )}
    </div>
  )
}

function DeleteAttachmentButton({ id, filename }: { id: string; filename: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState(deleteAttachmentAction, EMPTY_STATE)

  useEffect(() => {
    if (state.ok) router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={`Eliminar ${filename}`}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  )
}
