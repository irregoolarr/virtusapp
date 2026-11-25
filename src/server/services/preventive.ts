import { and, desc, eq, gt, isNull, lte, ne } from "drizzle-orm";
import { customers, db, preventiveMaintenances, products, serviceNumbers, users } from "@/db";
import { formatForEmail } from "@/lib/utils";
import { badRequest, definedFields, notFound, serialize } from "@/server/http";
import { PM_CATEGORIES } from "@/shared/constants";
import { nextVisitDate } from "@/shared/pm";
import { formatDuration } from "@/shared/sla";
import type { PreventiveItem } from "@/shared/types";
import { pmCompleteSchema, preventiveCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { logActivity, notifyByEmail } from "./activities";
import {
  checkCategory,
  checkServiceBelongsToCustomer,
  customerContact,
  getCommentCounts,
  managerEmails,
  nextFormattedCode,
  nextSequence,
  parseDateOrNull,
  removeRecordArtifacts,
  userContact,
} from "./common";

type CreateInput = z.output<typeof preventiveCreateSchema>;
type UpdateInput = Partial<CreateInput>;
type PmRow = typeof preventiveMaintenances.$inferSelect;

const ENTITY = "preventive" as const;

// ---- Reads -----------------------------------------------------------------

export async function listPreventive(): Promise<PreventiveItem[]> {
  const [rows, commentMap] = await Promise.all([
    db
      .select({
        item: preventiveMaintenances,
        customerName: customers.name,
        customerEmail: customers.contactEmail,
        customerAddress: customers.address,
        productName: products.name,
        serviceCode: serviceNumbers.serviceNumber,
        assigneeName: users.name,
        assigneeJobTitle: users.jobTitle,
        assigneeAvatarColor: users.avatarColor,
      })
      .from(preventiveMaintenances)
      .leftJoin(customers, eq(preventiveMaintenances.customerId, customers.id))
      .leftJoin(products, eq(preventiveMaintenances.productId, products.id))
      .leftJoin(serviceNumbers, eq(preventiveMaintenances.serviceNumberId, serviceNumbers.id))
      .leftJoin(users, eq(preventiveMaintenances.assigneeId, users.id))
      .orderBy(desc(preventiveMaintenances.createdAt)),
    getCommentCounts(ENTITY),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

async function getPlan(id: number): Promise<PmRow> {
  const [row] = await db.select().from(preventiveMaintenances).where(eq(preventiveMaintenances.id, id)).limit(1);
  if (!row) throw notFound();
  return row;
}

const checklistProgress = (p: PmRow) => `${p.checklist.filter((c) => c.done).length}/${p.checklist.length} checks done`;

// ---- Create / update / delete ---------------------------------------------------

/** Insert a visit and record + announce it (used by create and "schedule next"). */
async function insertPlan(d: CreateInput, actorId: number, note?: string): Promise<PmRow> {
  checkCategory(PM_CATEGORIES, d.category, d.subcategory);
  await checkServiceBelongsToCustomer(d.serviceNumberId, d.customerId);

  const seq = await nextSequence(preventiveMaintenances.id);
  const [created] = await db
    .insert(preventiveMaintenances)
    .values({
      id: seq,
      planCode: nextFormattedCode("PM", seq),
      title: d.title,
      description: d.description,
      frequency: d.frequency,
      status: d.status,
      category: d.category,
      subcategory: d.subcategory,
      scheduledDate: parseDateOrNull(d.scheduledDate) ?? new Date(),
      lastCompletedAt: d.status === "Completed" ? new Date() : null,
      completionNotes: d.completionNotes ?? null,
      checklist: d.checklist,
      customerId: d.customerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      assigneeId: d.assigneeId ?? actorId,
    })
    .returning();

  const code = created.planCode;
  await logActivity({
    entityType: ENTITY,
    entityId: created.id,
    type: "Update",
    category: "Visit Scheduled",
    subject: `${code} scheduled for ${formatForEmail(created.scheduledDate)} (${created.frequency})`,
    body: [note, `${created.category} / ${created.subcategory}`, created.description].filter(Boolean).join("\n\n"),
    actorId,
  });
  const assignee = await userContact(created.assigneeId);
  if (assignee) {
    await notifyByEmail({
      entityType: ENTITY,
      entityId: created.id,
      to: [assignee.email],
      subject: `${code} preventive visit assigned to you — ${formatForEmail(created.scheduledDate)}`,
      body: `Hello ${assignee.name},\n\n${code} — ${created.title}\nScheduled: ${formatForEmail(created.scheduledDate)}\nFrequency: ${created.frequency}\nType: ${created.category} / ${created.subcategory}\n\nChecklist:\n${created.checklist.map((c) => `- ${c.label}`).join("\n") || "-"}`,
      actorId,
    });
  }
  return created;
}

export async function createPreventive(d: CreateInput, actorId: number) {
  return serialize(await insertPlan(d, actorId));
}

export async function updatePreventive(id: number, d: UpdateInput, actorId: number) {
  const before = await getPlan(id);
  if (d.category !== undefined || d.subcategory !== undefined) {
    checkCategory(PM_CATEGORIES, d.category ?? before.category, d.subcategory ?? before.subcategory);
  }
  if (d.serviceNumberId !== undefined || d.customerId !== undefined) {
    await checkServiceBelongsToCustomer(
      d.serviceNumberId !== undefined ? d.serviceNumberId : before.serviceNumberId,
      d.customerId !== undefined ? d.customerId : before.customerId
    );
  }
  if (d.status === "Completed" && before.status !== "Completed") {
    throw badRequest("Use Complete to finish a visit (it records the completion report)");
  }

  const rescheduled = d.scheduledDate !== undefined ? parseDateOrNull(d.scheduledDate) : null;
  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, [
      "title",
      "description",
      "frequency",
      "category",
      "subcategory",
      "completionNotes",
      "checklist",
      "customerId",
      "serviceNumberId",
      "productId",
      "assigneeId",
    ] as const),
    ...(d.status !== undefined && d.status !== before.status && { status: d.status }),
    // A new date re-arms the reminder and overdue alerts.
    ...(rescheduled &&
      rescheduled.getTime() !== before.scheduledDate.getTime() && {
        scheduledDate: rescheduled,
        reminderSentAt: null,
        overdueNotifiedAt: null,
      }),
  };
  const [updated] = await db.update(preventiveMaintenances).set(patch).where(eq(preventiveMaintenances.id, id)).returning();
  if (!updated) throw notFound();
  await recordChanges(before, updated, actorId);
  return serialize(updated);
}

async function recordChanges(before: PmRow, after: PmRow, actorId: number) {
  const code = after.planCode;
  const base = { entityType: ENTITY, entityId: after.id, actorId };
  const assignee = await userContact(after.assigneeId);

  if (before.status !== after.status) {
    await logActivity({ ...base, type: "Update", category: "Status Change", subject: `${code} - Status changed: ${before.status} → ${after.status}` });
  }
  if (before.scheduledDate.getTime() !== after.scheduledDate.getTime()) {
    await logActivity({
      ...base,
      type: "Update",
      category: "Rescheduled",
      subject: `${code} rescheduled: ${formatForEmail(before.scheduledDate)} → ${formatForEmail(after.scheduledDate)}`,
    });
    if (assignee) {
      await notifyByEmail({
        ...base,
        to: [assignee.email],
        subject: `${code} rescheduled to ${formatForEmail(after.scheduledDate)}`,
        body: `${code} — ${after.title}\nNew date: ${formatForEmail(after.scheduledDate)} (was ${formatForEmail(before.scheduledDate)})`,
      });
    }
  }
  if (before.category !== after.category || before.subcategory !== after.subcategory) {
    await logActivity({
      ...base,
      type: "Update",
      category: "Category Change",
      subject: `${code} - Type: ${before.category} / ${before.subcategory} → ${after.category} / ${after.subcategory}`,
    });
  }
  if (before.assigneeId !== after.assigneeId) {
    await logActivity({ ...base, type: "Update", category: "Assignment", subject: `${code} is assigned to ${assignee?.name ?? "nobody"}` });
    if (assignee) {
      await notifyByEmail({
        ...base,
        to: [assignee.email],
        subject: `${code} preventive visit assigned to you — ${formatForEmail(after.scheduledDate)}`,
        body: `Hello ${assignee.name},\n\n${code} — ${after.title}\nScheduled: ${formatForEmail(after.scheduledDate)}\nStatus: ${after.status}`,
      });
    }
  }
}

export async function deletePreventive(id: number): Promise<void> {
  const [deleted] = await db.delete(preventiveMaintenances).where(eq(preventiveMaintenances.id, id)).returning();
  if (!deleted) throw notFound();
  await removeRecordArtifacts(ENTITY, id);
}

// ---- Lifecycle: Complete (+ schedule next visit) ------------------------------------

export async function completePreventive(id: number, d: z.output<typeof pmCompleteSchema>, actorId: number) {
  const before = await getPlan(id);
  if (before.status === "Completed") throw badRequest(`${before.planCode} is already completed`);

  const cust = d.notifyCustomer ? await customerContact(before.customerId) : null;
  if (d.notifyCustomer && !cust) throw badRequest("This plan has no customer contact email to notify");
  const nextDate = d.scheduleNext ? parseDateOrNull(d.nextScheduledDate) ?? nextVisitDate(before.scheduledDate, before.frequency) : null;

  const now = new Date();
  const [after] = await db
    .update(preventiveMaintenances)
    .set({ status: "Completed", lastCompletedAt: now, completionNotes: d.completionNotes, updatedAt: now })
    .where(eq(preventiveMaintenances.id, id))
    .returning();

  const code = after.planCode;
  const base = { entityType: ENTITY, entityId: id, actorId };
  const openChecks = after.checklist.filter((c) => !c.done).map((c) => c.label);
  await logActivity({
    ...base,
    type: "Update",
    category: "Completed",
    subject: `${code} completed (${checklistProgress(after)})`,
    body: [d.completionNotes, openChecks.length ? `Not done: ${openChecks.join(", ")}` : ""].filter(Boolean).join("\n\n"),
  });

  if (cust) {
    await notifyByEmail({
      ...base,
      to: [cust.email],
      subject: `Preventive maintenance report ${code} — ${after.title}`,
      body: [
        `Dear ${cust.contactName || cust.name},`,
        "",
        `We completed the scheduled preventive maintenance "${after.title}" (${code}) on ${formatForEmail(now)}.`,
        "",
        "Checklist:",
        ...after.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.label}`),
        "",
        "Findings & actions:",
        d.completionNotes,
        ...(nextDate ? ["", `Next visit: ${formatForEmail(nextDate)}`] : []),
        "",
        "Regards,",
        "Virtus Management Service Team",
      ].join("\n"),
    });
  }

  let next: PmRow | null = null;
  if (nextDate) {
    next = await insertPlan(
      {
        title: after.title,
        description: after.description,
        frequency: after.frequency as CreateInput["frequency"],
        status: "Scheduled",
        scheduledDate: nextDate.toISOString(),
        category: after.category,
        subcategory: after.subcategory,
        completionNotes: null,
        checklist: after.checklist.map((c) => ({ ...c, done: false })),
        customerId: after.customerId,
        serviceNumberId: after.serviceNumberId,
        productId: after.productId,
        assigneeId: after.assigneeId,
      },
      actorId,
      `Next ${after.frequency.toLowerCase()} visit after ${code}.`
    );
    await logActivity({ ...base, type: "Update", category: "Next Visit", subject: `Next visit ${next.planCode} scheduled for ${formatForEmail(next.scheduledDate)}` });
  }
  return { item: serialize(after), next: next ? serialize(next) : null };
}


// ---- Schedule monitoring --------------------------------------------------------

/**
 * 1. Remind the engineer about visits in the next 24 hours.
 * 2. Alert the engineer and managers when a visit's day has passed without completion.
 * Each visit is alerted once per scheduled date.
 */
export async function runPmChecks(): Promise<{ reminded: number; overdue: number }> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3_600_000);
  const overdueBefore = new Date(now.getTime() - 24 * 3_600_000);

  const [toRemind, toAlert] = await Promise.all([
    db
      .select()
      .from(preventiveMaintenances)
      .where(
        and(
          ne(preventiveMaintenances.status, "Completed"),
          isNull(preventiveMaintenances.reminderSentAt),
          gt(preventiveMaintenances.scheduledDate, now),
          lte(preventiveMaintenances.scheduledDate, in24h)
        )
      ),
    db
      .select()
      .from(preventiveMaintenances)
      .where(
        and(
          ne(preventiveMaintenances.status, "Completed"),
          isNull(preventiveMaintenances.overdueNotifiedAt),
          lte(preventiveMaintenances.scheduledDate, overdueBefore)
        )
      ),
  ]);
  if (toRemind.length === 0 && toAlert.length === 0) return { reminded: 0, overdue: 0 };

  let reminded = 0;
  for (const p of toRemind) {
    const [claimed] = await db
      .update(preventiveMaintenances)
      .set({ reminderSentAt: now })
      .where(and(eq(preventiveMaintenances.id, p.id), isNull(preventiveMaintenances.reminderSentAt)))
      .returning({ id: preventiveMaintenances.id });
    if (!claimed) continue;
    reminded += 1;
    const assignee = await userContact(p.assigneeId);
    if (!assignee) continue;
    await notifyByEmail({
      entityType: ENTITY,
      entityId: p.id,
      to: [assignee.email],
      subject: `Reminder: ${p.planCode} preventive visit ${formatForEmail(p.scheduledDate)}`,
      body: `${p.planCode} — ${p.title}\nScheduled: ${formatForEmail(p.scheduledDate)}\n\nChecklist:\n${p.checklist.map((c) => `- ${c.label}`).join("\n") || "-"}`,
    });
  }

  const managers = toAlert.length ? await managerEmails() : [];
  let overdue = 0;
  for (const p of toAlert) {
    const [claimed] = await db
      .update(preventiveMaintenances)
      .set({ overdueNotifiedAt: now })
      .where(and(eq(preventiveMaintenances.id, p.id), isNull(preventiveMaintenances.overdueNotifiedAt)))
      .returning({ id: preventiveMaintenances.id });
    if (!claimed) continue;
    overdue += 1;
    const assignee = await userContact(p.assigneeId);
    const late = formatDuration((now.getTime() - p.scheduledDate.getTime()) / 60_000);
    await logActivity({ entityType: ENTITY, entityId: p.id, type: "Update", category: "Overdue", subject: `${p.planCode} is overdue (scheduled ${late} ago)` });
    await notifyByEmail({
      entityType: ENTITY,
      entityId: p.id,
      to: [...new Set([...(assignee ? [assignee.email] : []), ...managers])],
      subject: `OVERDUE: ${p.planCode} ${p.title}`,
      body: `${p.planCode} was scheduled for ${formatForEmail(p.scheduledDate)} and is not completed.\nStatus: ${p.status}\nOwner: ${assignee?.name ?? "Unassigned"}`,
    });
  }
  return { reminded, overdue };
}
