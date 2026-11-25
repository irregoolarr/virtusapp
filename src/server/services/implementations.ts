import { and, desc, eq, gt, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { businessPartners, customers, db, implementations, products, serviceNumbers, users } from "@/db";
import { formatForEmail } from "@/lib/utils";
import { badRequest, definedFields, notFound, serialize } from "@/server/http";
import { IMPL_DUE_SOON_DAYS } from "@/shared/constants";
import { formatDuration } from "@/shared/sla";
import type { ImplementationItem } from "@/shared/types";
import { goLiveSchema, implementationCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { logActivity, notifyByEmail } from "./activities";
import {
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

type CreateInput = z.output<typeof implementationCreateSchema>;
type UpdateInput = Partial<CreateInput>;
type ImplRow = typeof implementations.$inferSelect;

const ENTITY = "implementation" as const;

export async function listImplementations(): Promise<ImplementationItem[]> {
  const [rows, commentMap] = await Promise.all([
    db
      .select({
        item: implementations,
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
      .from(implementations)
      .leftJoin(customers, eq(implementations.customerId, customers.id))
      .leftJoin(businessPartners, eq(implementations.partnerId, businessPartners.id))
      .leftJoin(products, eq(implementations.productId, products.id))
      .leftJoin(serviceNumbers, eq(implementations.serviceNumberId, serviceNumbers.id))
      .leftJoin(users, eq(implementations.leadUserId, users.id))
      .orderBy(desc(implementations.createdAt)),
    getCommentCounts(ENTITY),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

async function getProject(id: number): Promise<ImplRow> {
  const [row] = await db.select().from(implementations).where(eq(implementations.id, id)).limit(1);
  if (!row) throw notFound();
  return row;
}

const milestoneProgress = (p: ImplRow) => `${p.milestones.filter((m) => m.completed).length}/${p.milestones.length} milestones`;

export async function createImplementation(d: CreateInput, actorId: number) {
  if (d.status === "Go-Live") throw badRequest("Use Go-Live to finish a project (it records the handover)");
  await checkServiceBelongsToCustomer(d.serviceNumberId, d.customerId);

  const seq = await nextSequence(implementations.id);
  const [created] = await db
    .insert(implementations)
    .values({
      id: seq,
      projectCode: nextFormattedCode("IMP", seq),
      title: d.title,
      description: d.description,
      status: d.status,
      projectType: d.projectType,
      progressPct: d.progressPct,
      targetGoLive: parseDateOrNull(d.targetGoLive),
      milestones: d.milestones,
      blockers: d.blockers?.trim() || null,
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      leadUserId: d.leadUserId ?? actorId,
    })
    .returning();

  const code = created.projectCode;
  await logActivity({
    entityType: ENTITY,
    entityId: created.id,
    type: "Update",
    category: "Project Created",
    subject: `${code} created (${created.projectType}) — target go-live ${formatForEmail(created.targetGoLive)}`,
    body: created.description,
    actorId,
  });
  const lead = await userContact(created.leadUserId);
  if (lead) {
    await notifyByEmail({
      entityType: ENTITY,
      entityId: created.id,
      to: [lead.email],
      subject: `${code} implementation assigned to you`,
      body: `Hello ${lead.name},\n\n${code} — ${created.title}\nType: ${created.projectType}\nPhase: ${created.status}\nTarget go-live: ${formatForEmail(created.targetGoLive)}\n\nMilestones:\n${created.milestones.map((m) => `- ${m.title}`).join("\n") || "-"}`,
      actorId,
    });
  }
  if (created.blockers) await announceBlocker(created, actorId);
  return serialize(created);
}

export async function updateImplementation(id: number, d: UpdateInput, actorId: number) {
  const before = await getProject(id);
  if (d.status === "Go-Live" && before.status !== "Go-Live") {
    throw badRequest("Use Go-Live to finish a project (it records the handover)");
  }
  if (d.serviceNumberId !== undefined || d.customerId !== undefined) {
    await checkServiceBelongsToCustomer(
      d.serviceNumberId !== undefined ? d.serviceNumberId : before.serviceNumberId,
      d.customerId !== undefined ? d.customerId : before.customerId
    );
  }
  const newTarget = d.targetGoLive !== undefined ? parseDateOrNull(d.targetGoLive) : undefined;
  const targetChanged = newTarget !== undefined && (newTarget?.getTime() ?? null) !== (before.targetGoLive?.getTime() ?? null);

  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, [
      "title",
      "description",
      "projectType",
      "progressPct",
      "milestones",
      "customerId",
      "partnerId",
      "serviceNumberId",
      "productId",
      "leadUserId",
    ] as const),
    ...(d.status !== undefined && d.status !== before.status && { status: d.status }),
    ...(d.blockers !== undefined && { blockers: d.blockers?.trim() || null }),
    // A new target date re-arms the reminder and overdue alerts.
    ...(targetChanged && { targetGoLive: newTarget, reminderSentAt: null, overdueNotifiedAt: null }),
  };
  const [updated] = await db.update(implementations).set(patch).where(eq(implementations.id, id)).returning();
  if (!updated) throw notFound();
  await recordChanges(before, updated, actorId);
  return serialize(updated);
}

/** Email the lead and managers when a blocker is raised. */
async function announceBlocker(p: ImplRow, actorId: number) {
  await logActivity({ entityType: ENTITY, entityId: p.id, type: "Update", category: "Blocker Raised", subject: `${p.projectCode} - Blocker raised`, body: p.blockers ?? "", actorId });
  const lead = await userContact(p.leadUserId);
  await notifyByEmail({
    entityType: ENTITY,
    entityId: p.id,
    to: [...new Set([...(lead ? [lead.email] : []), ...(await managerEmails())])],
    subject: `BLOCKER: ${p.projectCode} ${p.title}`,
    body: `${p.projectCode} — ${p.title}\nPhase: ${p.status} (${p.progressPct}%)\nTarget go-live: ${formatForEmail(p.targetGoLive)}\n\nBlocker:\n${p.blockers}`,
    actorId,
  });
}

async function recordChanges(before: ImplRow, after: ImplRow, actorId: number) {
  const code = after.projectCode;
  const base = { entityType: ENTITY, entityId: after.id, actorId };

  if (before.status !== after.status) {
    await logActivity({ ...base, type: "Update", category: "Phase Change", subject: `${code} - Phase: ${before.status} → ${after.status} (${after.progressPct}%)` });
  }
  if ((before.targetGoLive?.getTime() ?? null) !== (after.targetGoLive?.getTime() ?? null)) {
    await logActivity({
      ...base,
      type: "Update",
      category: "Target Changed",
      subject: `${code} - Target go-live: ${formatForEmail(before.targetGoLive)} → ${formatForEmail(after.targetGoLive)}`,
    });
  }
  const doneBefore = new Set(before.milestones.filter((m) => m.completed).map((m) => m.id));
  for (const m of after.milestones.filter((m) => m.completed && !doneBefore.has(m.id))) {
    await logActivity({ ...base, type: "Update", category: "Milestone", subject: `${code} - Milestone completed: ${m.title}` });
  }
  if (after.blockers && after.blockers !== before.blockers) await announceBlocker(after, actorId);
  if (!after.blockers && before.blockers) {
    await logActivity({ ...base, type: "Update", category: "Blocker Cleared", subject: `${code} - Blocker cleared`, body: before.blockers });
  }
  if (before.leadUserId !== after.leadUserId) {
    const lead = await userContact(after.leadUserId);
    await logActivity({ ...base, type: "Update", category: "Assignment", subject: `${code} is led by ${lead?.name ?? "nobody"}` });
    if (lead) {
      await notifyByEmail({
        ...base,
        to: [lead.email],
        subject: `${code} implementation assigned to you`,
        body: `Hello ${lead.name},\n\n${code} — ${after.title}\nPhase: ${after.status} (${after.progressPct}%)\nTarget go-live: ${formatForEmail(after.targetGoLive)}`,
      });
    }
  }
}

export async function deleteImplementation(id: number): Promise<void> {
  const [deleted] = await db.delete(implementations).where(eq(implementations.id, id)).returning();
  if (!deleted) throw notFound();
  await removeRecordArtifacts(ENTITY, id);
}

// ---- Go-Live -------------------------------------------------------------------

export async function goLiveImplementation(id: number, d: z.output<typeof goLiveSchema>, actorId: number) {
  const before = await getProject(id);
  if (before.status === "Go-Live") throw badRequest(`${before.projectCode} is already live`);
  const cust = d.notifyCustomer ? await customerContact(before.customerId) : null;
  if (d.notifyCustomer && !cust) throw badRequest("This project has no customer contact email to notify");

  const now = new Date();
  const [after] = await db
    .update(implementations)
    .set({
      status: "Go-Live",
      progressPct: 100,
      goLiveAt: now,
      handoverNotes: d.handoverNotes,
      blockers: null,
      // Go-live completes the plan.
      milestones: before.milestones.map((m) => ({ ...m, completed: true })),
      updatedAt: now,
    })
    .where(eq(implementations.id, id))
    .returning();

  const code = after.projectCode;
  const base = { entityType: ENTITY, entityId: id, actorId };
  const openBefore = before.milestones.filter((m) => !m.completed).map((m) => m.title);
  await logActivity({
    ...base,
    type: "Update",
    category: "Go-Live",
    subject: `${code} is live (${milestoneProgress(before)} done before go-live)`,
    body: [d.handoverNotes, openBefore.length ? `Closed at go-live: ${openBefore.join(", ")}` : ""].filter(Boolean).join("\n\n"),
  });
  const lead = await userContact(after.leadUserId);
  const recipients = [...new Set([...(lead ? [lead.email] : []), ...(await managerEmails())])];
  await notifyByEmail({ ...base, to: recipients, subject: `${code} went live — ${after.title}`, body: `${code} went live on ${formatForEmail(now)}.\n\nHandover:\n${d.handoverNotes}` });

  if (cust) {
    await notifyByEmail({
      ...base,
      to: [cust.email],
      subject: `${after.title} is now live (${code})`,
      body: [
        `Dear ${cust.contactName || cust.name},`,
        "",
        `We are pleased to confirm that "${after.title}" (${code}) went live on ${formatForEmail(now)}.`,
        "",
        "Handover notes:",
        d.handoverNotes,
        "",
        "Support is now provided by the Virtus Management Service Team. Please contact us for any issue.",
        "",
        "Regards,",
        "Virtus Management Service Team",
      ].join("\n"),
    });
  }
  return serialize(after);
}

// ---- Target date monitoring -----------------------------------------------------

/** Remind the lead 7 days before the target go-live; alert lead + managers when it passes. */
export async function runImplChecks(): Promise<{ reminded: number; overdue: number }> {
  const now = new Date();
  const soon = new Date(now.getTime() + IMPL_DUE_SOON_DAYS * 86_400_000);
  const overdueBefore = new Date(now.getTime() - 86_400_000);

  const [toRemind, toAlert] = await Promise.all([
    db
      .select()
      .from(implementations)
      .where(
        and(
          ne(implementations.status, "Go-Live"),
          isNull(implementations.reminderSentAt),
          isNotNull(implementations.targetGoLive),
          gt(implementations.targetGoLive, now),
          lte(implementations.targetGoLive, soon)
        )
      ),
    db
      .select()
      .from(implementations)
      .where(
        and(
          ne(implementations.status, "Go-Live"),
          isNull(implementations.overdueNotifiedAt),
          isNotNull(implementations.targetGoLive),
          lte(implementations.targetGoLive, overdueBefore)
        )
      ),
  ]);
  if (toRemind.length === 0 && toAlert.length === 0) return { reminded: 0, overdue: 0 };

  let reminded = 0;
  for (const p of toRemind) {
    const [claimed] = await db
      .update(implementations)
      .set({ reminderSentAt: now })
      .where(and(eq(implementations.id, p.id), isNull(implementations.reminderSentAt)))
      .returning({ id: implementations.id });
    if (!claimed) continue;
    reminded += 1;
    const lead = await userContact(p.leadUserId);
    if (!lead) continue;
    await notifyByEmail({
      entityType: ENTITY,
      entityId: p.id,
      to: [lead.email],
      subject: `Reminder: ${p.projectCode} go-live ${formatForEmail(p.targetGoLive)}`,
      body: `${p.projectCode} — ${p.title}\nPhase: ${p.status} (${p.progressPct}%)\n${milestoneProgress(p)}\nTarget go-live: ${formatForEmail(p.targetGoLive)}${p.blockers ? `\n\nOpen blocker:\n${p.blockers}` : ""}`,
    });
  }

  const managers = toAlert.length ? await managerEmails() : [];
  let overdue = 0;
  for (const p of toAlert) {
    const [claimed] = await db
      .update(implementations)
      .set({ overdueNotifiedAt: now })
      .where(and(eq(implementations.id, p.id), isNull(implementations.overdueNotifiedAt)))
      .returning({ id: implementations.id });
    if (!claimed) continue;
    overdue += 1;
    const lead = await userContact(p.leadUserId);
    const late = formatDuration((now.getTime() - (p.targetGoLive?.getTime() ?? now.getTime())) / 60_000);
    await logActivity({ entityType: ENTITY, entityId: p.id, type: "Update", category: "Overdue", subject: `${p.projectCode} missed its target go-live (${late} ago)` });
    await notifyByEmail({
      entityType: ENTITY,
      entityId: p.id,
      to: [...new Set([...(lead ? [lead.email] : []), ...managers])],
      subject: `LATE: ${p.projectCode} missed its target go-live`,
      body: `${p.projectCode} — ${p.title}\nTarget go-live: ${formatForEmail(p.targetGoLive)}\nPhase: ${p.status} (${p.progressPct}%)\nLead: ${lead?.name ?? "Unassigned"}${p.blockers ? `\n\nOpen blocker:\n${p.blockers}` : ""}`,
    });
  }
  return { reminded, overdue };
}
