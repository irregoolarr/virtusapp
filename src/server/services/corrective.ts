import { and, desc, eq, inArray, isNotNull, isNull, lte, notInArray } from "drizzle-orm";
import {
  activities,
  attachments,
  businessPartners,
  correctiveMaintenances,
  customers,
  db,
  products,
  roles,
  serviceNumbers,
  users,
} from "@/db";
import { badRequest, definedFields, notFound, serialize } from "@/server/http";
import type { CorrectiveItem } from "@/shared/types";
import { closeSchema, correctiveCreateSchema, reopenSchema, resolveSchema } from "@/shared/schemas";
import { CM_CATEGORIES, CORRECTIVE_DONE_STAGES, isCorrectiveDone } from "@/shared/constants";
import { defaultSlaDue, formatDuration } from "@/shared/sla";
import type { z } from "zod";
import { logActivity, notifyByEmail } from "./activities";
import { deleteAttachmentRow } from "./attachments";
import { getCommentCounts, nextFormattedCode, nextSequence, parseDateOrNull } from "./common";
import { getOpsPreferences } from "./settings";

type CreateInput = z.output<typeof correctiveCreateSchema>;
type UpdateInput = Partial<CreateInput>;
type CorrectiveRow = typeof correctiveMaintenances.$inferSelect;

const ENTITY = "corrective" as const;
const DONE = [...CORRECTIVE_DONE_STAGES];

// ---- Reads -----------------------------------------------------------------

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
    getCommentCounts(ENTITY),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

async function getTicket(id: number): Promise<CorrectiveRow> {
  const [row] = await db.select().from(correctiveMaintenances).where(eq(correctiveMaintenances.id, id)).limit(1);
  if (!row) throw notFound();
  return row;
}

async function userContact(id: number | null | undefined) {
  if (!id) return null;
  const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

/** Active Super Admins and Service Managers — the escalation audience. */
async function managerEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.isActive, true), inArray(roles.slug, ["super_admin", "service_manager"])));
  return rows.map((r) => r.email);
}

// ---- Validation --------------------------------------------------------------

function requireResolution(status: string | undefined, detail: string | null | undefined) {
  if (status && isCorrectiveDone(status) && !detail?.trim()) {
    throw badRequest("Resolution detail is required to resolve or close a ticket");
  }
}

function checkCategory(category: string, subcategory: string) {
  const subs = CM_CATEGORIES[category];
  if (!subs) throw badRequest(`Unknown category: ${category}`);
  if (!subs.includes(subcategory)) throw badRequest(`"${subcategory}" is not a subcategory of ${category}`);
}

/** A service number must belong to the ticket's customer. */
async function checkServiceBelongsToCustomer(serviceNumberId: number | null | undefined, customerId: number | null | undefined) {
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

// ---- Create / update / delete ---------------------------------------------------

export async function createCorrective(d: CreateInput, actorId: number) {
  requireResolution(d.status, d.resolutionDetail);
  checkCategory(d.category, d.subcategory);
  await checkServiceBelongsToCustomer(d.serviceNumberId, d.customerId);

  const now = new Date();
  const seq = await nextSequence(correctiveMaintenances.id);
  const [created] = await db
    .insert(correctiveMaintenances)
    .values({
      id: seq,
      ticketCode: nextFormattedCode("CM", seq),
      title: d.title,
      description: d.description,
      severity: d.severity,
      status: d.status,
      category: d.category,
      subcategory: d.subcategory,
      source: d.source,
      rootCause: d.rootCause ?? null,
      resolutionDetail: d.resolutionDetail ?? null,
      // No target given → default SLA from priority (Critical 4h, High 8h, ...).
      dueDate: parseDateOrNull(d.dueDate) ?? defaultSlaDue(d.severity, now),
      resolvedAt: isCorrectiveDone(d.status) ? now : null,
      closedAt: d.status === "Closed" ? now : null,
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      assigneeId: d.assigneeId ?? actorId,
    })
    .returning();

  const code = created.ticketCode;
  await logActivity({
    entityType: ENTITY,
    entityId: created.id,
    type: "Update",
    category: "Ticket Logged",
    subject: `${code} has been logged (${created.severity}, via ${created.source})`,
    body: `${created.category} / ${created.subcategory}\n\n${created.description}`,
    actorId,
  });
  const assignee = await userContact(created.assigneeId);
  if (assignee) {
    await notifyByEmail({
      entityType: ENTITY,
      entityId: created.id,
      to: [assignee.email],
      subject: `${code} has been logged and assigned to you`,
      body: `Hello ${assignee.name},\n\n${code} — ${created.title}\nPriority: ${created.severity}\nCategory: ${created.category} / ${created.subcategory}\nSLA target: ${created.dueDate?.toISOString() ?? "—"}\n\n${created.description}`,
      actorId,
    });
  }
  return serialize(created);
}

export async function updateCorrective(id: number, d: UpdateInput, actorId: number) {
  const before = await getTicket(id);
  requireResolution(d.status, d.resolutionDetail ?? before.resolutionDetail);
  if (d.category !== undefined || d.subcategory !== undefined) {
    checkCategory(d.category ?? before.category, d.subcategory ?? before.subcategory);
  }
  if (d.serviceNumberId !== undefined || d.customerId !== undefined) {
    await checkServiceBelongsToCustomer(
      d.serviceNumberId !== undefined ? d.serviceNumberId : before.serviceNumberId,
      d.customerId !== undefined ? d.customerId : before.customerId
    );
  }

  const statusChanged = d.status !== undefined && d.status !== before.status;
  const now = new Date();
  const patch = {
    updatedAt: now,
    ...definedFields(d, [
      "title",
      "description",
      "severity",
      "category",
      "subcategory",
      "source",
      "rootCause",
      "resolutionDetail",
      "customerId",
      "partnerId",
      "serviceNumberId",
      "productId",
      "assigneeId",
    ] as const),
    ...(statusChanged && {
      status: d.status,
      resolvedAt: isCorrectiveDone(d.status!) ? before.resolvedAt ?? now : null,
      closedAt: d.status === "Closed" ? now : null,
    }),
    ...(d.dueDate !== undefined && { dueDate: parseDateOrNull(d.dueDate), slaBreachNotifiedAt: null }),
  };
  const [updated] = await db.update(correctiveMaintenances).set(patch).where(eq(correctiveMaintenances.id, id)).returning();
  if (!updated) throw notFound();

  await recordChanges(before, updated, actorId);
  return serialize(updated);
}

/** Activity History + notification emails for meaningful changes made in the edit form. */
async function recordChanges(before: CorrectiveRow, after: CorrectiveRow, actorId: number) {
  const code = after.ticketCode;
  const base = { entityType: ENTITY, entityId: after.id, actorId };
  const assignee = await userContact(after.assigneeId);

  if (before.status !== after.status) {
    await logActivity({
      ...base,
      type: "Update",
      category: after.status === "Resolved" ? "Resolution" : after.status === "Closed" ? "Closed" : "Status Change",
      subject: `${code} - Status changed: ${before.status} → ${after.status}`,
      body: after.status === "Resolved" ? after.resolutionDetail ?? "" : "",
    });
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

  if (before.category !== after.category || before.subcategory !== after.subcategory) {
    await logActivity({
      ...base,
      type: "Update",
      category: "Category Change",
      subject: `${code} - Category: ${before.category} / ${before.subcategory} → ${after.category} / ${after.subcategory}`,
    });
  }

  if (before.assigneeId !== after.assigneeId) {
    await logActivity({ ...base, type: "Update", category: "Assignment", subject: `${code} is assigned to ${assignee?.name ?? "nobody"}` });
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
    .where(and(eq(attachments.entityType, ENTITY), eq(attachments.entityId, id)));
  for (const f of files) await deleteAttachmentRow(f.id);
  await db.delete(activities).where(and(eq(activities.entityType, ENTITY), eq(activities.entityId, id)));
}

// ---- Lifecycle actions: Resolve → Close, or Reopen ---------------------------------

export async function resolveCorrective(id: number, d: z.output<typeof resolveSchema>, actorId: number) {
  const before = await getTicket(id);
  if (isCorrectiveDone(before.status)) throw badRequest(`${before.ticketCode} is already ${before.status.toLowerCase()}`);

  // Check the customer can be notified before changing anything.
  const [cust] =
    d.notifyCustomer && before.customerId
      ? await db
          .select({ name: customers.name, contactName: customers.contactName, email: customers.contactEmail })
          .from(customers)
          .where(eq(customers.id, before.customerId))
      : [];
  if (d.notifyCustomer && !cust?.email) throw badRequest("This ticket has no customer contact email to notify");

  const now = new Date();
  const [after] = await db
    .update(correctiveMaintenances)
    .set({ status: "Resolved", resolutionDetail: d.resolutionDetail, resolvedAt: now, updatedAt: now })
    .where(eq(correctiveMaintenances.id, id))
    .returning();

  const code = after.ticketCode;
  const base = { entityType: ENTITY, entityId: id, actorId };
  await logActivity({ ...base, type: "Update", category: "Resolution", subject: `${code} has been resolved`, body: d.resolutionDetail });

  const assignee = await userContact(after.assigneeId);
  if (assignee) {
    await notifyByEmail({
      ...base,
      to: [assignee.email],
      subject: `${code} has been resolved`,
      body: `${code} — ${after.title}\n\nResolution detail:\n${d.resolutionDetail}`,
    });
  }

  if (d.notifyCustomer && cust?.email) {
    await notifyByEmail({
      ...base,
      to: [cust.email],
      subject: `Your incident ${code} has been resolved`,
      body: [
        `Dear ${cust.contactName || cust.name},`,
        "",
        `Your incident ${code} — "${after.title}" has been resolved.`,
        "",
        "Resolution:",
        d.resolutionDetail,
        "",
        "If the issue persists, simply reply to this email or contact the Virtus Management Service Team and we will reopen the ticket.",
        "",
        "Regards,",
        "Virtus Management Service Team",
      ].join("\n"),
    });
  }
  return serialize(after);
}

export async function closeCorrective(id: number, d: z.output<typeof closeSchema>, actorId: number) {
  const before = await getTicket(id);
  if (before.status !== "Resolved") throw badRequest("Only resolved tickets can be closed (resolve it first)");
  const now = new Date();
  const [after] = await db
    .update(correctiveMaintenances)
    .set({ status: "Closed", closedAt: now, updatedAt: now })
    .where(eq(correctiveMaintenances.id, id))
    .returning();
  await logActivity({
    entityType: ENTITY,
    entityId: id,
    type: "Update",
    category: "Closed",
    subject: `${after.ticketCode} has been closed`,
    body: d.note || "Customer confirmed the resolution.",
    actorId,
  });
  return serialize(after);
}

export async function reopenCorrective(id: number, d: z.output<typeof reopenSchema>, actorId: number) {
  const before = await getTicket(id);
  if (!isCorrectiveDone(before.status)) throw badRequest(`${before.ticketCode} is not resolved or closed`);
  const now = new Date();
  const [after] = await db
    .update(correctiveMaintenances)
    .set({
      status: "Diagnosing",
      resolvedAt: null,
      closedAt: null,
      reopenCount: before.reopenCount + 1,
      // A reopened ticket gets a fresh SLA window and can be escalated again.
      dueDate: defaultSlaDue(before.severity, now),
      escalatedAt: null,
      slaBreachNotifiedAt: null,
      updatedAt: now,
    })
    .where(eq(correctiveMaintenances.id, id))
    .returning();

  const base = { entityType: ENTITY, entityId: id, actorId };
  await logActivity({
    ...base,
    type: "Update",
    category: "Reopened",
    subject: `${after.ticketCode} has been reopened (${after.reopenCount}x)`,
    body: d.reason,
  });
  const assignee = await userContact(after.assigneeId);
  if (assignee) {
    await notifyByEmail({
      ...base,
      to: [assignee.email],
      subject: `${after.ticketCode} has been reopened`,
      body: `${after.ticketCode} — ${after.title}\n\nReason:\n${d.reason}`,
    });
  }
  return serialize(after);
}

// ---- SLA monitoring (run by cron / scheduler / opportunistically) ------------------

let lastSlaRun = 0;

/**
 * 1. Escalate Critical tickets open longer than the "auto-escalate" minutes in Settings.
 * 2. Alert on tickets past their SLA target.
 * Each ticket is alerted once (escalatedAt / slaBreachNotifiedAt).
 */
export async function runSlaChecks(opts: { minIntervalMs?: number } = {}): Promise<{ escalated: number; breached: number }> {
  if (opts.minIntervalMs && Date.now() - lastSlaRun < opts.minIntervalMs) return { escalated: 0, breached: 0 };
  lastSlaRun = Date.now();

  const now = new Date();
  const { autoEscalateCriticalMinutes } = await getOpsPreferences();
  const escalateBefore = new Date(now.getTime() - autoEscalateCriticalMinutes * 60_000);

  const [toEscalate, toBreach] = await Promise.all([
    db
      .select()
      .from(correctiveMaintenances)
      .where(
        and(
          eq(correctiveMaintenances.severity, "Critical"),
          notInArray(correctiveMaintenances.status, DONE),
          isNull(correctiveMaintenances.escalatedAt),
          lte(correctiveMaintenances.createdAt, escalateBefore)
        )
      ),
    db
      .select()
      .from(correctiveMaintenances)
      .where(
        and(
          notInArray(correctiveMaintenances.status, DONE),
          isNotNull(correctiveMaintenances.dueDate),
          lte(correctiveMaintenances.dueDate, now),
          isNull(correctiveMaintenances.slaBreachNotifiedAt)
        )
      ),
  ]);
  if (toEscalate.length === 0 && toBreach.length === 0) return { escalated: 0, breached: 0 };

  const managers = await managerEmails();

  for (const t of toEscalate) {
    // Claim first so parallel runs don't double-send.
    const [claimed] = await db
      .update(correctiveMaintenances)
      .set({ escalatedAt: now })
      .where(and(eq(correctiveMaintenances.id, t.id), isNull(correctiveMaintenances.escalatedAt)))
      .returning({ id: correctiveMaintenances.id });
    if (!claimed) continue;
    const assignee = await userContact(t.assigneeId);
    const openFor = formatDuration((now.getTime() - t.createdAt.getTime()) / 60_000);
    await logActivity({ entityType: ENTITY, entityId: t.id, type: "Update", category: "Escalation", subject: `${t.ticketCode} escalated — Critical open for ${openFor}` });
    await notifyByEmail({
      entityType: ENTITY,
      entityId: t.id,
      to: [...new Set([...managers, ...(assignee ? [assignee.email] : [])])],
      subject: `ESCALATION: ${t.ticketCode} Critical incident open for ${openFor}`,
      body: `${t.ticketCode} — ${t.title}\nStatus: ${t.status}\nOwner: ${assignee?.name ?? "Unassigned"}\n\nThis Critical incident has been open longer than ${autoEscalateCriticalMinutes} minutes.`,
    });
  }

  for (const t of toBreach) {
    const [claimed] = await db
      .update(correctiveMaintenances)
      .set({ slaBreachNotifiedAt: now })
      .where(and(eq(correctiveMaintenances.id, t.id), isNull(correctiveMaintenances.slaBreachNotifiedAt)))
      .returning({ id: correctiveMaintenances.id });
    if (!claimed) continue;
    const assignee = await userContact(t.assigneeId);
    await logActivity({ entityType: ENTITY, entityId: t.id, type: "Update", category: "SLA Breach", subject: `${t.ticketCode} breached its SLA target` });
    await notifyByEmail({
      entityType: ENTITY,
      entityId: t.id,
      to: [...new Set([...(assignee ? [assignee.email] : []), ...managers])],
      subject: `SLA BREACHED: ${t.ticketCode} ${t.title}`,
      body: `${t.ticketCode} passed its SLA target (${t.dueDate?.toISOString()}).\nPriority: ${t.severity}\nStatus: ${t.status}\nOwner: ${assignee?.name ?? "Unassigned"}`,
    });
  }

  return { escalated: toEscalate.length, breached: toBreach.length };
}
