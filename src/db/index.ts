import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://virtus:virtus_dev_pass@localhost:5432/virtusapp";

declare global {
  // eslint-disable-next-line no-var
  var __virtusPgPool: Pool | undefined;
}

// Reuse one pool per process (survives dev hot reload).
export const pool =
  globalThis.__virtusPgPool ??
  new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 15),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

globalThis.__virtusPgPool = pool;

export const db = drizzle(pool, { schema });
export * from "./schema";
