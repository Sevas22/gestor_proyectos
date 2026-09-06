'use client'

import { useEffect, useState } from 'react'

import { formatDate, relativeTime } from '@/lib/format'

/// Tiempo relativo («hace 5 minutos») que no rompe la hidratación.
///
/// El texto se calcula contra la hora actual, así que el que escribe el
/// servidor y el que calcula el navegador al hidratar casi nunca coinciden:
/// es un desajuste garantizado, y React lo trataba como error de hidratación.
///
/// `suppressHydrationWarning` le dice a React que en este nodo la diferencia
/// es esperada. Pero al suprimirla React también deja el texto del servidor
/// puesto, que ya está desfasado; por eso el efecto fuerza un render más al
/// montar, y ese sí escribe la hora del navegador, que es la que se lee.
export function TimeAgo({ date, className }: { date: Date | string; className?: string }) {
  const [, refrescar] = useState(0)

  useEffect(() => {
    refrescar((n) => n + 1)
  }, [date])

  const value = typeof date === 'string' ? new Date(date) : date

  return (
    <time
      dateTime={value.toISOString()}
      title={formatDate(value)}
      className={className}
      suppressHydrationWarning
    >
      {relativeTime(value)}
    </time>
  )
}
