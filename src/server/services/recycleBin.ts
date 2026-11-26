// Recycle Bin: Delete on every business module moves the record here instead of erasing it.
//
// moveToRecycleBin() saves an exact JSON copy of the row (to_jsonb) plus every row the
// delete cascades to (e.g. a customer's service numbers), notes which rows the delete
// will blank out (ON DELETE SET NULL, e.g. tickets pointing at that customer), then runs
// the normal DELETE. Restore re-inserts the copies with the same id and code
// (jsonb_populate_record keeps every column's type) and re-links those rows.
// List, dashboard, report and alert queries are unchanged: a binned record simply
// isn't in its table. Its Activity History, attachments and notes are keyed by
// (entity_type, entity_id), so they stay in place and are only removed on purge.
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db, deletedRecords, entityComments, users } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { hasPermission, type PermissionKey } from "@/lib/rbac";
import { ApiError, notFound, serialize } from "@/server/http";
import type { EntityType } from "@/server/entities";
import { RECYCLE_BIN_DAYS } from "@/shared/constants";
import type { RecycleBinItem, RecycleBinResponse } from "@/shared/types";
import { logActivity } from "./activities";
import { removeRecordArtifacts } from "./common";

/** Modules whose Delete goes to the bin. `permission` guards delete, restore and purge. */
export const BIN_MODULES = {
  corrective: { table: "corrective_maintenances", label: "Corrective", permission: "maintenance:delete" },
  preventive: { table: "preventive_maintenances", label: "Preventive", permission: "maintenance:delete" },
  implementation: { table: "implementations", label: "Implementation", permission: "delivery:delete" },
  poc: { table: "poc_records", label: "POC", permission: "delivery:delete" },
  pipeline: { table: "pipeline_deals", label: "Pipeline", permission: "pipeline:delete" },
  customer: { table: "customers", label: "Customer", permission: "customers:delete" },
  partner: { table: "business_partners", label: "Business Partner", permission: "customers:delete" },
  service: { table: "service_numbers", label: "Service Number", permission: "services:delete" },
  product: { table: "products", label: "Product", permission: "products:delete" },
  event: { table: "events", label: "Event", permission: "events:delete" },
} as const satisfies Record<string, { table: string; label: string; permission: PermissionKey }>;
export type BinModule = keyof typeof BIN_MODULES;

/** How to name rows of each table in messages, and which columns hold their code / title. */
const TABLES: Record<string, { one: string; many: string; code?: string; title?: string; entity?: EntityType }> = {
  corrective_maintenances: { one: "corrective ticket", many: "corrective tickets", code: "ticket_code", title: "title", entity: "corrective" },
  preventive_maintenances: { one: "preventive visit", many: "preventive visits", code: "plan_code", title: "title", entity: "preventive" },
  implementations: { one: "implementation", many: "implementations", code: "project_code", title: "title", entity: "implementation" },
  poc_records: { one: "POC", many: "POCs", code: "poc_code", title: "title", entity: "poc" },
  pipeline_deals: { one: "pipeline deal", many: "pipeline deals", code: "deal_code", title: "title", entity: "pipeline" },
  customers: { one: "customer", many: "customers", code: "code", title: "name", entity: "customer" },
  business_partners: { one: "business partner", many: "business partners", code: "code", title: "name" },
  service_numbers: { one: "service number", many: "service numbers", code: "service_number", title: "title" },
  products: { one: "product", many: "products", code: "sku", title: "name" },
  events: { one: "event", many: "events", code: "event_code", title: "title" },
  email_alert_logs: { one: "email log", many: "email logs" },
};
const noun = (table: string, n: number) => (n === 1 ? TABLES[table]?.one : TABLES[table]?.many) ?? `${table} row${n === 1 ? "" : "s"}`;

interface SavedRow {
  table: string;
  row: Record<string, unknown>;
}
/** Rows the delete set to NULL: `UPDATE table SET column = value WHERE id IN ids` on restore. */
interface Relink {
  table: string;
  column: string;
  ids: number[];
  value: number;
}
interface BinPayload {
  rows: SavedRow[];
  relinks: Relink[];
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const ident = (name: string) => sql.identifier(name);

/** Foreign keys pointing AT `table` (rule: c = cascade, n = set null, a/r = blocks the delete). */
async function referencingKeys(tx: Tx, table: string) {
  const { rows } = await tx.execute<{ child_table: string; child_column: string; rule: string }>(sql`
    select cl.relname as child_table, a.attname as child_column, c.confdeltype::text as rule
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = ${`public.${table}`}::regclass`);
  return rows;
}

/** Foreign keys going OUT of `table` (checked on restore: the parent may be gone). */
async function outgoingKeys(tx: Tx, table: string) {
  const { rows } = await tx.execute<{ column: string; parent_table: string; not_null: boolean }>(sql`
    select a.attname as column, pcl.relname as parent_table, a.attnotnull as not_null
    from pg_constraint c
    join pg_class pcl on pcl.oid = c.confrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.conrelid = ${`public.${table}`}::regclass`);
  return rows;
}

const labelOf = (s: SavedRow) => {
  const t = TABLES[s.table];
  const code = t?.code ? String(s.row[t.code] ?? "") : "";
  return code ? `${t?.one ?? s.table} ${code}` : `this ${t?.one ?? "record"}`;
};

/** Save `table`.id and everything its delete cascades to; refuse if something blocks it. */
async function capture(tx: Tx, table: string, id: number, payload: BinPayload, isRoot: boolean): Promise<void> {
  const { rows } = await tx.execute<{ row: Record<string, unknown> }>(
    sql`select to_jsonb(t) as row from ${ident(table)} t where t.id = ${id} for update`
  );
  if (!rows[0]) throw notFound();
  const saved: SavedRow = { table, row: rows[0].row };
  payload.rows.push(saved);

  for (const key of await referencingKeys(tx, table)) {
    const { rows: kids } = await tx.execute<{ id: number }>(
      sql`select id from ${ident(key.child_table)} where ${ident(key.child_column)} = ${id} order by id`
    );
    if (kids.length === 0) continue;
    const ids = kids.map((k) => Number(k.id));
    if (key.rule === "n") {
      payload.relinks.push({ table: key.child_table, column: key.child_column, ids, value: id });
    } else if (key.rule === "c") {
      for (const kid of ids) await capture(tx, key.child_table, kid, payload, false);
    } else {
      const what = isRoot ? `this ${TABLES[table]?.one ?? "record"}` : labelOf(saved);
      throw new ApiError(
        409,
        `Can't delete: ${what} is still used by ${ids.length} ${noun(key.child_table, ids.length)}. Change or delete ${ids.length === 1 ? "it" : "them"} first.`
      );
    }
  }
}

/** Delete a record by moving it (and whatever its delete cascades to) into the Recycle Bin. */
export async function moveToRecycleBin(module: BinModule, id: number, actorId: number | null): Promise<void> {
  const { table } = BIN_MODULES[module];
  const info = TABLES[table];
  const payload: BinPayload = { rows: [], relinks: [] };

  await db.transaction(async (tx) => {
    await capture(tx, table, id, payload, true);
    const root = payload.rows[0].row;
    const extra = new Map<string, number>();
    for (const r of payload.rows.slice(1)) extra.set(r.table, (extra.get(r.table) ?? 0) + 1);
    const includes = [...extra].map(([t, n]) => `+ ${n} ${noun(t, n)}`).join(", ") || null;

    await tx.insert(deletedRecords).values({
      entityType: module,
      entityId: id,
      code: String(root[info.code!] ?? `#${id}`),
      title: String(root[info.title!] ?? ""),
      includes,
      payload,
      deletedById: actorId,
    });
    await tx.execute(sql`delete from ${ident(table)} where id = ${id}`);
  });

  if (info.entity && ["corrective", "preventive", "implementation", "poc"].includes(info.entity)) {
    await logActivity({
      entityType: info.entity,
      entityId: id,
      type: "Update",
      category: "Recycle Bin",
      subject: `${payload.rows[0].row[info.code!]} - Moved to the Recycle Bin`,
      actorId,
    });
  }
  void purgeExpired().catch((err) => console.error("Recycle Bin purge failed", err));
}

function pgError(err: unknown): { code?: string; detail?: string; constraint?: string } {
  const e = err as { code?: string; cause?: unknown };
  return (e?.code ? e : (e?.cause as object)) ?? {};
}

function canUse(user: AuthenticatedUser, module: string): module is BinModule {
  return module in BIN_MODULES && hasPermission(user.permissions, BIN_MODULES[module as BinModule].permission);
}

async function getEntry(user: AuthenticatedUser, entryId: number) {
  const [entry] = await db.select().from(deletedRecords).where(eq(deletedRecords.id, entryId)).limit(1);
  if (!entry) throw notFound("Recycle Bin entry not found (it may have been restored or purged)");
  if (!canUse(user, entry.entityType)) {
    throw new ApiError(403, `Missing permission: ${BIN_MODULES[entry.entityType as BinModule]?.permission ?? entry.entityType}`);
  }
  return entry;
}

/** Put a binned record back with its original id and code, and re-link what pointed at it. */
export async function restoreFromRecycleBin(user: AuthenticatedUser, entryId: number): Promise<{ notes: string[] }> {
  const entry = await getEntry(user, entryId);
  const payload = entry.payload as BinPayload;
  const notes: string[] = [];

  await db.transaction(async (tx) => {
    for (const saved of payload.rows) {
      const row = { ...saved.row };
      for (const key of await outgoingKeys(tx, saved.table)) {
        const value = row[key.column];
        if (value === null || value === undefined) continue;
        const { rows } = await tx.execute(sql`select 1 from ${ident(key.parent_table)} where id = ${value as number}`);
        if (rows.length) continue;
        const parent = TABLES[key.parent_table]?.one ?? key.parent_table;
        if (key.not_null) {
          throw new ApiError(409, `Can't restore ${labelOf(saved)}: its ${parent} no longer exists. Restore the ${parent} first.`);
        }
        row[key.column] = null;
        notes.push(`${labelOf(saved)}: its ${parent} no longer exists, so that field was left empty`);
      }
      try {
        await tx.execute(
          sql`insert into ${ident(saved.table)} select * from jsonb_populate_record(null::${ident(saved.table)}, ${JSON.stringify(row)}::jsonb)`
        );
      } catch (err) {
        const pg = pgError(err);
        if (pg.code === "23505") {
          throw new ApiError(409, `Can't restore ${labelOf(saved)}: another record now uses the same value (${pg.detail ?? pg.constraint}).`);
        }
        throw err;
      }
    }
    // Re-link rows the delete had blanked, unless someone has set them to something else since.
    for (const link of payload.relinks) {
      await tx.execute(sql`
        update ${ident(link.table)} set ${ident(link.column)} = ${link.value}
        where ${ident(link.column)} is null and id in (${sql.join(link.ids.map((i) => sql`${i}`), sql`, `)})`);
    }
    await tx.delete(deletedRecords).where(eq(deletedRecords.id, entry.id));
  });

  const info = TABLES[BIN_MODULES[entry.entityType as BinModule].table];
  if (info.entity && ["corrective", "preventive", "implementation", "poc"].includes(info.entity)) {
    await logActivity({
      entityType: info.entity,
      entityId: entry.entityId,
      type: "Update",
      category: "Recycle Bin",
      subject: `${entry.code} - Restored from the Recycle Bin`,
      actorId: user.id,
    });
  }
  return { notes };
}

/** Remove the entry for good, with the Activity History, attachments and notes it kept. */
async function purgeEntry(entry: typeof deletedRecords.$inferSelect): Promise<void> {
  const payload = entry.payload as BinPayload;
  await db.delete(deletedRecords).where(eq(deletedRecords.id, entry.id));
  for (const saved of payload.rows) {
    const entity = TABLES[saved.table]?.entity;
    if (!entity) continue;
    const id = Number(saved.row.id);
    await removeRecordArtifacts(entity, id);
    await db.delete(entityComments).where(and(eq(entityComments.entityType, entity), eq(entityComments.entityId, id)));
  }
}

export async function purgeFromRecycleBin(user: AuthenticatedUser, entryId: number): Promise<void> {
  await purgeEntry(await getEntry(user, entryId));
}

/** Purge entries older than RECYCLE_BIN_DAYS. */
export async function purgeExpired(): Promise<number> {
  const cutoff = new Date(Date.now() - RECYCLE_BIN_DAYS * 86_400_000);
  const expired = await db.select().from(deletedRecords).where(lt(deletedRecords.deletedAt, cutoff));
  for (const entry of expired) await purgeEntry(entry);
  return expired.length;
}

/** Entries for the modules this user may delete in. */
export async function listRecycleBin(user: AuthenticatedUser): Promise<RecycleBinResponse> {
  await purgeExpired();
  const modules = (Object.keys(BIN_MODULES) as BinModule[]).filter((m) => canUse(user, m));
  if (modules.length === 0) return { items: [], retentionDays: RECYCLE_BIN_DAYS };
  const rows = await db
    .select({
      id: deletedRecords.id,
      module: deletedRecords.entityType,
      entityId: deletedRecords.entityId,
      code: deletedRecords.code,
      title: deletedRecords.title,
      includes: deletedRecords.includes,
      deletedAt: deletedRecords.deletedAt,
      deletedByName: users.name,
    })
    .from(deletedRecords)
    .leftJoin(users, eq(deletedRecords.deletedById, users.id))
    .where(inArray(deletedRecords.entityType, modules))
    .orderBy(desc(deletedRecords.deletedAt));
  const items: RecycleBinItem[] = rows.map((r) =>
    serialize({
      ...r,
      moduleLabel: BIN_MODULES[r.module as BinModule].label,
      purgeAt: new Date(r.deletedAt.getTime() + RECYCLE_BIN_DAYS * 86_400_000),
    })
  );
  return { items, retentionDays: RECYCLE_BIN_DAYS };
}
