import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, entityComments } from "@/db";

export function parseNumericId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Record not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function parseDateOrNull(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getCommentCounts(entityType: string): Promise<Map<number, number>> {
  const rows = await db
    .select({
      entityId: entityComments.entityId,
      count: sql<number>`count(*)::int`,
    })
    .from(entityComments)
    .where(eq(entityComments.entityType, entityType))
    .groupBy(entityComments.entityId);

  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.entityId, r.count);
  }
  return map;
}

export function nextFormattedCode(prefix: string, nextSeq: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(nextSeq).padStart(3, "0")}`;
}
