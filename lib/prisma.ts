import { PrismaClient } from '@prisma/client'

// En desarrollo Next recarga los módulos en cada cambio. Sin este singleton
// cada recarga abriría un pool nuevo hasta agotar las conexiones de Neon.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
