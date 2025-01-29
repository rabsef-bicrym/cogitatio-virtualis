// cogitatio-virtualis/virtualis-terminal/lib/threads/prisma.ts

import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

declare global {
  // allow global prisma in dev mode
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient()
  }
  prisma = global.__prisma
}

export { prisma }
