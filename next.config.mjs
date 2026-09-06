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
  // Las server actions cortan el cuerpo en 1 MB por defecto, y una subida de 4
  // MB no llegaría al código. Se sube a 4,5 MB y no más: ese es el máximo que
  // Vercel acepta en el cuerpo de una función, y permitir más aquí solo daría
  // un error 413 en producción que no aparece en local.
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
