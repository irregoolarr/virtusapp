// DANGER: drops every table in the target database (all data is lost).
// Used by `pnpm db:reset` to start from zero. Requires CONFIRM_RESET=yes.
import { sql } from "drizzle-orm";
import { db, pool } from "./index";

async function reset() {
  if (process.env.CONFIRM_RESET !== "yes") {
    throw new Error("Refusing to drop tables. Re-run with CONFIRM_RESET=yes if you really want to erase this database.");
  }
  const target = (process.env.DATABASE_URL ?? "local default").replace(/:\/\/[^@]*@/, "://***@");
  const { rows } = await db.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  for (const { tablename } of rows) {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS "public"."${tablename.replace(/"/g, '""')}" CASCADE`));
  }
  console.log(`Dropped ${rows.length} table(s) in ${target}`);
}

reset()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
