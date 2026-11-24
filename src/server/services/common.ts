import { eq, getTableName, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db, entityComments } from "@/db";

/**
 * Reserve the next id from the table's own serial sequence. The record is then
 * inserted with this id, and its human code (CM-2026-009) is derived from it, so
 * codes are unique, never reused after a delete, and safe under concurrent creates.
 */
export async function nextSequence(idColumn: AnyPgColumn): Promise<number> {
  const table = getTableName(idColumn.table);
  const { rows } = await db.execute<{ id: string }>(
    sql`SELECT nextval(pg_get_serial_sequence(${table}, ${idColumn.name}))::text AS id`
  );
  return Number(rows[0].id);
}

/** e.g. nextFormattedCode("CM", 9) -> "CM-2026-009" */
export function nextFormattedCode(prefix: string, nextSeq: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(nextSeq).padStart(3, "0")}`;
}

export function parseDateOrNull(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Comment counts per record id for one entity type. */
export async function getCommentCounts(entityType: string): Promise<Map<number, number>> {
  const rows = await db
    .select({ entityId: entityComments.entityId, count: sql<number>`count(*)::int` })
    .from(entityComments)
    .where(eq(entityComments.entityType, entityType))
    .groupBy(entityComments.entityId);
  return new Map(rows.map((r) => [r.entityId, r.count]));
}
