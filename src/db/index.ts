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

export const pool =
  globalThis.__virtusPgPool ??
  new Pool({
    connectionString,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__virtusPgPool = pool;
}

export const db = drizzle(pool, { schema });
export * from "./schema";
