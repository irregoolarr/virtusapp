import { and, desc, eq } from "drizzle-orm";
import { activities, db, users } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { sendAlertEmail } from "@/lib/mailer";
import type { EntityType } from "@/server/entities";
import { ApiError, notFound, serialize } from "@/server/http";
import type { ActivityItem } from "@/shared/types";

export type ActivityType = "Email" | "Note" | "Update" | "Attachment";

export async function logActivity(entry: {
  entityType: EntityType;
  entityId: number;
  type: ActivityType;
  category: string;
  subject: string;
  body?: string;
  actorId?: number | null;
}): Promise<void> {
  await db.insert(activities).values({
    entityType: entry.entityType,
    entityId: entry.entityId,
    type: entry.type,
    category: entry.category,
    subject: entry.subject.slice(0, 300),
    body: entry.body ?? "",
    actorId: entry.actorId ?? null,
  });
}

/**
 * Send a notification email and record it in the record's Activity History.
 * Email problems never fail the business action; they are logged as "Failed".
 */
export async function notifyByEmail(params: {
  entityType: EntityType;
  entityId: number;
  to: string[];
  subject: string;
  body: string;
  actorId?: number | null;
}): Promise<void> {
  const recipients = params.to.filter(Boolean);
  if (recipients.length === 0) return;
  let status = "Failed";
  try {
    status = (await sendAlertEmail({ recipients, subject: params.subject, body: params.body })).status;
  } catch {
    status = "Failed";
  }
  await logActivity({
    entityType: params.entityType,
    entityId: params.entityId,
    type: "Email",
    category: "Outgoing Email",
    subject: params.subject,
    body: `To: ${recipients.join(", ")}\nDelivery: ${status}\n\n${params.body}`,
    actorId: params.actorId,
  });
}

export async function listActivities(entityType: EntityType, entityId: number): Promise<ActivityItem[]> {
  const rows = await db
    .select({ item: activities, actorName: users.name })
    .from(activities)
    .leftJoin(users, eq(activities.actorId, users.id))
    .where(and(eq(activities.entityType, entityType), eq(activities.entityId, entityId)))
    .orderBy(desc(activities.createdAt), desc(activities.id));
  return rows.map(({ item, actorName }) => serialize({ ...item, actorName }));
}

export async function addNote(entityType: EntityType, entityId: number, subject: string, body: string, actor: AuthenticatedUser) {
  await logActivity({ entityType, entityId, type: "Note", category: "Note", subject, body, actorId: actor.id });
}

/** Only notes can be deleted (system history is kept), by their author or an admin. */
export async function deleteActivity(id: number, actor: AuthenticatedUser): Promise<{ entityType: string }> {
  const [row] = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
  if (!row) throw notFound();
  if (row.type !== "Note") throw new ApiError(400, "Only notes can be deleted; system history is kept for audit");
  if (row.actorId !== actor.id && !hasPermission(actor.permissions, "rbac:manage")) {
    throw new ApiError(403, "You can only delete your own notes");
  }
  await db.delete(activities).where(eq(activities.id, id));
  return { entityType: row.entityType };
}

export async function getActivity(id: number) {
  const [row] = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
  if (!row) throw notFound();
  return row;
}
