import { and, desc, eq } from "drizzle-orm";
import { activities, attachments, businessPartners, correctiveMaintenances, customers, db, products, serviceNumbers, users } from "@/db";
import { badRequest, definedFields, notFound, serialize } from "@/server/http";
import { logActivity, notifyByEmail } from "./activities";
import { deleteAttachmentRow } from "./attachments";
import type { CorrectiveItem } from "@/shared/types";
import { correctiveCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { getCommentCounts, nextFormattedCode, nextSequence, parseDateOrNull } from "./common";

type CreateInput = z.output<typeof correctiveCreateSchema>;
type UpdateInput = Partial<CreateInput>;

export async function listCorrective(): Promise<CorrectiveItem[]> {
  const [rows, commentMap] = await Promise.all([
    db
      .select({
        item: correctiveMaintenances,
        customerName: customers.name,
        customerEmail: customers.contactEmail,
        customerAddress: customers.address,
        partnerName: businessPartners.name,
        productName: products.name,
        serviceCode: serviceNumbers.serviceNumber,
        assigneeName: users.name,
        assigneeJobTitle: users.jobTitle,
        assigneeAvatarColor: users.avatarColor,
      })
      .from(correctiveMaintenances)
      .leftJoin(customers, eq(correctiveMaintenances.customerId, customers.id))
      .leftJoin(businessPartners, eq(correctiveMaintenances.partnerId, businessPartners.id))
      .leftJoin(products, eq(correctiveMaintenances.productId, products.id))
      .leftJoin(serviceNumbers, eq(correctiveMaintenances.serviceNumberId, serviceNumbers.id))
      .leftJoin(users, eq(correctiveMaintenances.assigneeId, users.id))
      .orderBy(desc(correctiveMaintenances.createdAt)),
    getCommentCounts("corrective"),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

/** Email address and name of a user, or null. */
async function userContact(id: number | null | undefined) {
  if (!id) return null;
  const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

function requireResolution(status: string | undefined, detail: string | null | undefined) {
  if (status === "Resolved" && !detail?.trim()) {
    throw badRequest("Resolution detail is required to resolve a ticket");
  }
}

export async function createCorrective(d: CreateInput, actorId: number) {
  requireResolution(d.status, d.resolutionDetail);
  const seq = await nextSequence(correctiveMaintenances.id);
  const [created] = await db
    .insert(correctiveMaintenances)
    .values({
      ticketCode: nextFormattedCode("CM", seq),
      title: d.title,
      description: d.description,
      severity: d.severity,
      status: d.status,
      rootCause: d.rootCause ?? null,
      resolutionDetail: d.resolutionDetail ?? null,
      dueDate: parseDateOrNull(d.dueDate),
      resolvedAt: d.status === "Resolved" ? new Date() : null,
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      assigneeId: d.assigneeId ?? actorId,
    })
    .returning();

  const code = created.ticketCode;
  await logActivity({
    entityType: "corrective",
    entityId: created.id,
    type: "Update",
    category: "Ticket Logged",
    subject: `${code} has been logged (${created.severity})`,
    body: created.description,
    actorId,
  });
  const assignee = await userContact(created.assigneeId);
  if (assignee) {
    await notifyByEmail({
      entityType: "corrective",
      entityId: created.id,
      to: [assignee.email],
      subject: `${code} has been logged and assigned to you`,
      body: `Hello ${assignee.name},\n\n${code} — ${created.title}\nPriority: ${created.severity}\nStatus: ${created.status}\n\n${created.description}`,
      actorId,
    });
  }
  return serialize(created);
}

export async function updateCorrective(id: number, d: UpdateInput, actorId: number) {
  const [before] = await db.select().from(correctiveMaintenances).where(eq(correctiveMaintenances.id, id)).limit(1);
  if (!before) throw notFound();
  requireResolution(d.status, d.resolutionDetail ?? before.resolutionDetail);

  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, [
      "title",
      "description",
      "severity",
      "rootCause",
      "resolutionDetail",
      "customerId",
      "partnerId",
      "serviceNumberId",
      "productId",
      "assigneeId",
    ] as const),
    ...(d.status !== undefined && { status: d.status, resolvedAt: d.status === "Resolved" ? new Date() : null }),
    ...(d.dueDate !== undefined && { dueDate: parseDateOrNull(d.dueDate) }),
  };
  const [updated] = await db.update(correctiveMaintenances).set(patch).where(eq(correctiveMaintenances.id, id)).returning();
  if (!updated) throw notFound();

  await recordChanges(before, updated, actorId);
  return serialize(updated);
}

type CorrectiveRow = typeof correctiveMaintenances.$inferSelect;

/** Activity History + notification emails for meaningful changes. */
async function recordChanges(before: CorrectiveRow, after: CorrectiveRow, actorId: number) {
  const code = after.ticketCode;
  const base = { entityType: "corrective" as const, entityId: after.id, actorId };
  const assignee = await userContact(after.assigneeId);

  if (before.status !== after.status) {
    const resolved = after.status === "Resolved";
    await logActivity({
      ...base,
      type: "Update",
      category: resolved ? "Resolution" : "Status Change",
      subject: resolved ? `${code} has been resolved` : `${code} - Status changed: ${before.status} → ${after.status}`,
      body: resolved ? after.resolutionDetail ?? "" : "",
    });
    if (assignee && resolved) {
      await notifyByEmail({
        ...base,
        to: [assignee.email],
        subject: `${code} has been resolved`,
        body: `${code} — ${after.title}\n\nResolution detail:\n${after.resolutionDetail ?? ""}`,
      });
    }
  }

  if (before.severity !== after.severity) {
    await logActivity({ ...base, type: "Update", category: "Priority Change", subject: `${code} - Priority changed: ${before.severity} → ${after.severity}` });
    if (assignee) {
      await notifyByEmail({
        ...base,
        to: [assignee.email],
        subject: `${code} - Priority Changed`,
        body: `${code} — ${after.title}\nPriority changed from ${before.severity} to ${after.severity}.`,
      });
    }
  }

  if (before.assigneeId !== after.assigneeId) {
    await logActivity({
      ...base,
      type: "Update",
      category: "Assignment",
      subject: `${code} is assigned to ${assignee?.name ?? "nobody"}`,
    });
    if (assignee) {
      await notifyByEmail({
        ...base,
        to: [assignee.email],
        subject: `${code} is assigned to you`,
        body: `Hello ${assignee.name},\n\n${code} — ${after.title}\nPriority: ${after.severity}\nStatus: ${after.status}`,
      });
    }
  }
}

export async function deleteCorrective(id: number): Promise<void> {
  const [deleted] = await db.delete(correctiveMaintenances).where(eq(correctiveMaintenances.id, id)).returning();
  if (!deleted) throw notFound();
  // Remove the ticket's history and files (Drive copies are deleted best-effort).
  const files = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.entityType, "corrective"), eq(attachments.entityId, id)));
  for (const f of files) await deleteAttachmentRow(f.id);
  await db.delete(activities).where(and(eq(activities.entityType, "corrective"), eq(activities.entityId, id)));
}
