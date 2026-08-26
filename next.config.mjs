import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hay un package-lock.json en la carpeta padre (otro proyecto), y sin esto
  // Turbopack deduce que la raíz del workspace es esa carpeta.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  // La plantilla original traía typescript.ignoreBuildErrors: true, que deja
  // pasar a producción errores de tipos reales. Fuera: si no compila, hay que
  // arreglarlo, no silenciarlo.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
