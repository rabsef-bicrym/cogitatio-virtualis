// cogitatio-virtualis/virtualis-terminal/lib/api/vector-db.ts

import { Pool } from "pg";

declare global {
  // allow global pool reuse across HMR reloads in dev
  var __vectorPool: Pool | undefined;
}

/**
 * Lazy singleton Postgres pool for vector queries. Lazy so that builds,
 * tests, and tooling can import vector code without a database configured;
 * the first real query fails loudly instead.
 */
export function getVectorPool(): Pool {
  const connectionString =
    process.env.VECTOR_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL (or VECTOR_DATABASE_URL) must be set for vector search",
    );
  }

  if (process.env.NODE_ENV === "production") {
    if (!global.__vectorPool) {
      global.__vectorPool = new Pool({ connectionString, max: 3 });
    }
    return global.__vectorPool;
  }

  if (!global.__vectorPool) {
    global.__vectorPool = new Pool({ connectionString, max: 3 });
  }
  return global.__vectorPool;
}
