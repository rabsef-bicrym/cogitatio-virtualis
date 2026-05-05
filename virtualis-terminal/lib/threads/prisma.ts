// cogitatio-virtualis/virtualis-terminal/lib/threads/prisma.ts

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

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
