import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'

import { themeScript } from '@/lib/theme-script'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Nucleus — Gestor de proyectos',
    template: '%s · Nucleus',
  },
  description:
    'Gestor de proyectos para equipos de desarrollo: proyectos, tablero Kanban, roles y actividad del equipo.',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#181A21' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes del primer pintado para evitar el
            fogonazo blanco de quien usa el tema oscuro. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-background antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
