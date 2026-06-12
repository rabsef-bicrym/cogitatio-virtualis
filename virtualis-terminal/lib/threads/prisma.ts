// cogitatio-virtualis/virtualis-terminal/lib/threads/prisma.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/cogitatio_virtualis";
const adapter = new PrismaPg({ connectionString: databaseUrl });

let prisma: PrismaClient;

declare global {
  // allow global prisma in dev mode
  var __prisma: PrismaClient | undefined;
}

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ adapter });
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({ adapter });
  }
  prisma = global.__prisma;
}

export { prisma };
export type { PrismaClient };
