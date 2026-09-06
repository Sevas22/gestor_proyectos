'use client'

import { useRef, useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'

import {
  ACCEPT_ATTRIBUTE,
  MAX_ATTACHMENT_BYTES,
  MAX_FILES_PER_BATCH,
  fileKindLabel,
  formatBytes,
  validateAttachment,
} from '@/lib/attachments'
import { plural } from '@/lib/format'
import { FormMessage } from '@/components/ui/primitives'

/// Elige archivos y los guarda en memoria hasta que haya una tarea a la que
/// engancharlos.
///
/// El diálogo de crear tarea no puede adjuntar nada mientras la tarea no
/// exista, así que los archivos esperan aquí y se suben en cuanto el servidor
/// devuelve el id.
export function FilePicker({
  files,
  onChange,
  disabled,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function añadir(event: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = [...(event.target.files ?? [])]
    // El input se vacía siempre: si no, elegir el mismo archivo dos veces
    // seguidas no dispara el evento y parece que la aplicación se ha colgado.
    event.target.value = ''
    if (elegidos.length === 0) return

    const validos: File[] = []
    for (const file of elegidos) {
      const check = validateAttachment(file)
      if (!check.ok) {
        setError(`${file.name}: ${check.message}`)
        continue
      }
      // Mismo nombre y mismo tamaño: es el mismo archivo elegido dos veces.
      const repetido = [...files, ...validos].some(
        (f) => f.name === file.name && f.size === file.size,
      )
      if (!repetido) validos.push(file)
    }

    const total = [...files, ...validos]
    if (total.length > MAX_FILES_PER_BATCH) {
      setError(`Puedes adjuntar como mucho ${MAX_FILES_PER_BATCH} archivos a la vez.`)
      onChange(total.slice(0, MAX_FILES_PER_BATCH))
      return
    }

    if (validos.length > 0) setError(null)
    onChange(total)
  }

  function quitar(index: number) {
    onChange(files.filter((_, i) => i !== index))
    setError(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        onChange={añadir}
        disabled={disabled}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Paperclip className="size-4" />
        {files.length === 0 ? 'Elegir archivos' : 'Añadir más'}
      </button>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{file.name}</p>
                <p className="tabular text-[10px] text-muted-foreground">
                  {fileKindLabel(file.type)} · {formatBytes(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => quitar(index)}
                disabled={disabled}
                aria-label={`Quitar ${file.name}`}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        {files.length > 0
          ? `${plural(files.length, 'archivo')} · se subirán al crear la tarea`
          : `Hasta ${formatBytes(MAX_ATTACHMENT_BYTES)} por archivo. PDF, imágenes, documentos de Office, texto y ZIP.`}
      </p>

      {error && <FormMessage>{error}</FormMessage>}
    </div>
  )
}
