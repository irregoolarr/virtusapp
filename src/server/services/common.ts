import { eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db, entityComments } from "@/db";

/** Next sequence number for human-readable codes (CM-2026-009 etc.). */
export async function nextSequence(idColumn: AnyPgColumn): Promise<number> {
  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${idColumn}), 0)::int` })
    .from(idColumn.table);
  return maxId + 1;
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
