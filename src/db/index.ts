import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://virtus:virtus_dev_pass@localhost:5432/virtusapp";

// On Vercel each function instance gets its own pool, so keep it small and
// release idle connections quickly. Use the provider's *pooled* URL there.
const isServerless = Boolean(process.env.VERCEL);

declare global {
  // eslint-disable-next-line no-var
  var __virtusPgPool: Pool | undefined;
}

// Reuse one pool per process (dev hot reload and warm serverless instances).
export const pool =
  globalThis.__virtusPgPool ??
  new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? (isServerless ? 5 : 15)),
    idleTimeoutMillis: isServerless ? 10_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });

globalThis.__virtusPgPool = pool;

export const db = drizzle(pool, { schema });
export * from "./schema";
