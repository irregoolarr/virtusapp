import { and, eq, getTableName, inArray, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { activities, attachments, customers, db, entityComments, roles, serviceNumbers, users } from "@/db";
import { badRequest } from "@/server/http";

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

/** Name + email of a user, or null. */
export async function userContact(id: number | null | undefined): Promise<{ email: string; name: string } | null> {
  if (!id) return null;
  const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

/** Active Super Admins and Service Managers — the escalation audience. */
export async function managerEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.isActive, true), inArray(roles.slug, ["super_admin", "service_manager"])));
  return rows.map((r) => r.email);
}

/** A service number must belong to the record's customer. */
export async function checkServiceBelongsToCustomer(
  serviceNumberId: number | null | undefined,
  customerId: number | null | undefined
): Promise<void> {
  if (!serviceNumberId) return;
  const [srv] = await db
    .select({ customerId: serviceNumbers.customerId, number: serviceNumbers.serviceNumber })
    .from(serviceNumbers)
    .where(eq(serviceNumbers.id, serviceNumberId))
    .limit(1);
  if (!srv) throw badRequest("Service number not found");
  if (customerId && srv.customerId !== customerId) {
    throw badRequest(`Service ${srv.number} does not belong to the selected customer`);
  }
}

/** Category must exist and the subcategory must belong to it. */
export function checkCategory(categories: Record<string, readonly string[]>, category: string, subcategory: string): void {
  const subs = categories[category];
  if (!subs) throw badRequest(`Unknown category: ${category}`);
  if (!subs.includes(subcategory)) throw badRequest(`"${subcategory}" is not a subcategory of ${category}`);
}

/** Customer contact for notifications, or null when there is none. */
export async function customerContact(customerId: number | null | undefined) {
  if (!customerId) return null;
  const [c] = await db
    .select({ name: customers.name, contactName: customers.contactName, email: customers.contactEmail })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  return c?.email ? c : null;
}

/** Delete a record's Activity History and attachments (Drive copies best-effort). */
export async function removeRecordArtifacts(entityType: string, entityId: number): Promise<void> {
  const files = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)));
  const { deleteAttachmentRow } = await import("./attachments");
  for (const f of files) await deleteAttachmentRow(f.id);
  await db.delete(activities).where(and(eq(activities.entityType, entityType), eq(activities.entityId, entityId)));
}
