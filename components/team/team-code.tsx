'use client'

import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'

import { Card, CardHeader } from '@/components/ui/primitives'

/// Muestra el código con el que la gente pide entrar al equipo.
///
/// No es un secreto que dé acceso: con el código solo se consigue una solicitud
/// en espera, y sin aprobación no se ve nada. Por eso se puede enseñar en
/// pantalla y copiar sin más ceremonia.
export function TeamCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS) no se puede copiar solo.
      // El código está a la vista, así que se puede seleccionar a mano.
      setCopied(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Código del equipo"
        subtitle="Con esto piden entrar"
        action={<KeyRound className="size-4 text-muted-foreground" />}
      />
      <div className="p-5">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-accent px-3 py-2.5 font-mono text-sm font-semibold">
            {code}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label="Copiar el código del equipo"
            className="shrink-0 rounded-lg border border-border p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Quien lo tenga puede registrarse eligiendo <strong>Unirme a un equipo</strong>. Su
          solicitud llega aquí y no verá nada del equipo hasta que la apruebes.
        </p>
      </div>
    </Card>
  )
}
