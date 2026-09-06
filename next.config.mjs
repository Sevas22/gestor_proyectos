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
  // Las server actions cortan el cuerpo en 1 MB por defecto, así que una
  // subida de 5 MB fallaría antes de llegar al código. Se deja margen para lo
  // que añade multipart/form-data en límites y cabeceras de cada parte.
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
