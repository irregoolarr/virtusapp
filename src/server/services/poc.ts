import { and, desc, eq, gt, isNotNull, isNull, lte, notInArray } from "drizzle-orm";
import { businessPartners, customers, db, pipelineDeals, pocRecords, products, users } from "@/db";
import { formatForEmail } from "@/lib/utils";
import { badRequest, definedFields, notFound, serialize } from "@/server/http";
import { POC_DUE_SOON_DAYS, isPocFinished } from "@/shared/constants";
import { formatDuration } from "@/shared/sla";
import type { PocItem } from "@/shared/types";
import { pocCreateSchema, pocDecideSchema } from "@/shared/schemas";
import type { z } from "zod";
import { logActivity, notifyByEmail } from "./activities";
import {
  customerContact,
  getCommentCounts,
  managerEmails,
  nextFormattedCode,
  nextSequence,
  parseDateOrNull,
  userContact,
} from "./common";
import { moveToRecycleBin } from "./recycleBin";

type CreateInput = z.output<typeof pocCreateSchema>;
type UpdateInput = Partial<CreateInput>;
type PocRow = typeof pocRecords.$inferSelect;

const ENTITY = "poc" as const;
const FINISHED = ["Success", "Dropped"];

export async function listPocs(): Promise<PocItem[]> {
  const [rows, commentMap] = await Promise.all([
    db
      .select({
        item: pocRecords,
        customerName: customers.name,
        customerEmail: customers.contactEmail,
        customerAddress: customers.address,
        partnerName: businessPartners.name,
        productName: products.name,
        assigneeName: users.name,
        assigneeJobTitle: users.jobTitle,
        assigneeAvatarColor: users.avatarColor,
      })
      .from(pocRecords)
      .leftJoin(customers, eq(pocRecords.customerId, customers.id))
      .leftJoin(businessPartners, eq(pocRecords.partnerId, businessPartners.id))
      .leftJoin(products, eq(pocRecords.productId, products.id))
      .leftJoin(users, eq(pocRecords.leadUserId, users.id))
      .orderBy(desc(pocRecords.createdAt)),
    getCommentCounts(ENTITY),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

async function getPoc(id: number): Promise<PocRow> {
  const [row] = await db.select().from(pocRecords).where(eq(pocRecords.id, id)).limit(1);
  if (!row) throw notFound();
  return row;
}

/** Approval and outcomes are set only through Decide. */
function guardDecisionFields(d: UpdateInput) {
  if (d.status === "Approved") throw badRequest("Use Decide → Success to approve a POC");
  if (d.outcome !== undefined && d.outcome !== "Pending") throw badRequest("Use Decide to record the POC outcome");
}

export async function createPoc(d: CreateInput, actorId: number) {
  guardDecisionFields(d);
  const seq = await nextSequence(pocRecords.id);
  const [created] = await db
    .insert(pocRecords)
    .values({
      id: seq,
      pocCode: nextFormattedCode("POC", seq),
      title: d.title,
      description: d.description,
      status: d.status,
      outcome: "Pending",
      successCriteria: d.successCriteria,
      evaluationScore: d.evaluationScore,
      startDate: parseDateOrNull(d.startDate) ?? new Date(),
      targetReviewDate: parseDateOrNull(d.targetReviewDate),
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      productId: d.productId ?? null,
      leadUserId: d.leadUserId ?? actorId,
    })
    .returning();

  const code = created.pocCode;
  await logActivity({
    entityType: ENTITY,
    entityId: created.id,
    type: "Update",
    category: "POC Created",
    subject: `${code} created — review ${formatForEmail(created.targetReviewDate)}`,
    body: `Success criteria:\n${created.successCriteria}`,
    actorId,
  });
  const lead = await userContact(created.leadUserId);
  if (lead) {
    await notifyByEmail({
      entityType: ENTITY,
      entityId: created.id,
      to: [lead.email],
      subject: `${code} POC assigned to you`,
      body: `Hello ${lead.name},\n\n${code} — ${created.title}\nStage: ${created.status}\nReview date: ${formatForEmail(created.targetReviewDate)}\n\nSuccess criteria:\n${created.successCriteria}`,
      actorId,
    });
  }
  return serialize(created);
}

export async function updatePoc(id: number, d: UpdateInput, actorId: number) {
  const before = await getPoc(id);
  if (isPocFinished(before.outcome) && (d.status !== undefined || d.outcome !== undefined)) {
    throw badRequest(`${before.pocCode} is already decided (${before.outcome})`);
  }
  guardDecisionFields(d);

  const newReview = d.targetReviewDate !== undefined ? parseDateOrNull(d.targetReviewDate) : undefined;
  const reviewChanged = newReview !== undefined && (newReview?.getTime() ?? null) !== (before.targetReviewDate?.getTime() ?? null);
  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, ["title", "description", "successCriteria", "evaluationScore", "customerId", "partnerId", "productId", "leadUserId"] as const),
    ...(d.status !== undefined && d.status !== before.status && { status: d.status }),
    ...(d.startDate !== undefined && { startDate: parseDateOrNull(d.startDate) }),
    // A new review date re-arms the reminder and overdue alerts.
    ...(reviewChanged && { targetReviewDate: newReview, reminderSentAt: null, overdueNotifiedAt: null }),
  };
  const [after] = await db.update(pocRecords).set(patch).where(eq(pocRecords.id, id)).returning();
  if (!after) throw notFound();

  const code = after.pocCode;
  const base = { entityType: ENTITY, entityId: id, actorId };
  if (before.status !== after.status) {
    await logActivity({ ...base, type: "Update", category: "Stage Change", subject: `${code} - Stage: ${before.status} → ${after.status}` });
  }
  if (before.evaluationScore !== after.evaluationScore) {
    await logActivity({ ...base, type: "Update", category: "Score", subject: `${code} - Evaluation score ${before.evaluationScore}% → ${after.evaluationScore}%` });
  }
  if (reviewChanged) {
    await logActivity({
      ...base,
      type: "Update",
      category: "Review Rescheduled",
      subject: `${code} - Review date: ${formatForEmail(before.targetReviewDate)} → ${formatForEmail(after.targetReviewDate)}`,
    });
  }
  if (before.leadUserId !== after.leadUserId) {
    const lead = await userContact(after.leadUserId);
    await logActivity({ ...base, type: "Update", category: "Assignment", subject: `${code} is led by ${lead?.name ?? "nobody"}` });
    if (lead) {
      await notifyByEmail({
        ...base,
        to: [lead.email],
        subject: `${code} POC assigned to you`,
        body: `Hello ${lead.name},\n\n${code} — ${after.title}\nStage: ${after.status}\nReview date: ${formatForEmail(after.targetReviewDate)}`,
      });
    }
  }
  return serialize(after);
}

/** Moves the record to the Recycle Bin (restorable for RECYCLE_BIN_DAYS). */
export async function deletePoc(id: number, actorId: number | null = null): Promise<void> {
  await moveToRecycleBin("poc", id, actorId);
}

// ---- Decide: Success (→ Approved, optional pipeline deal) / Extended / Dropped -----

export async function decidePoc(id: number, d: z.output<typeof pocDecideSchema>, actorId: number) {
  const before = await getPoc(id);
  if (isPocFinished(before.outcome)) throw badRequest(`${before.pocCode} is already decided (${before.outcome})`);
  const cust = d.notifyCustomer ? await customerContact(before.customerId) : null;
  if (d.notifyCustomer && !cust) throw badRequest("This POC has no customer contact email to notify");
  const newReview = d.outcome === "Extended" ? parseDateOrNull(d.newReviewDate) : null;
  if (d.outcome === "Extended" && !newReview) throw badRequest("A valid new review date is required to extend the POC");

  const now = new Date();
  const [after] = await db
    .update(pocRecords)
    .set({
      outcome: d.outcome,
      evaluationScore: d.evaluationScore,
      decisionNotes: d.decisionNotes,
      updatedAt: now,
      ...(d.outcome === "Success" && { status: "Approved", decidedAt: now }),
      ...(d.outcome === "Dropped" && { decidedAt: now }),
      ...(d.outcome === "Extended" && {
        status: "Active Trial",
        targetReviewDate: newReview,
        extendedCount: before.extendedCount + 1,
        reminderSentAt: null,
        overdueNotifiedAt: null,
      }),
    })
    .where(eq(pocRecords.id, id))
    .returning();

  const code = after.pocCode;
  const base = { entityType: ENTITY, entityId: id, actorId };
  const verdict =
    d.outcome === "Success"
      ? `${code} approved (score ${d.evaluationScore}%)`
      : d.outcome === "Dropped"
        ? `${code} dropped (score ${d.evaluationScore}%)`
        : `${code} extended to ${formatForEmail(newReview)} (${after.extendedCount}x)`;
  await logActivity({ ...base, type: "Update", category: `Decision: ${d.outcome}`, subject: verdict, body: d.decisionNotes });

  const lead = await userContact(after.leadUserId);
  await notifyByEmail({
    ...base,
    to: [...new Set([...(lead ? [lead.email] : []), ...(await managerEmails())])],
    subject: `POC decision: ${verdict}`,
    body: `${code} — ${after.title}\nOutcome: ${d.outcome}\nScore: ${d.evaluationScore}%\n\n${d.decisionNotes}`,
  });

  if (cust) {
    const line =
      d.outcome === "Success"
        ? `the proof of concept "${after.title}" (${code}) has met its success criteria and is approved.`
        : d.outcome === "Dropped"
          ? `we have concluded the proof of concept "${after.title}" (${code}) and will not continue it at this time.`
          : `we are extending the proof of concept "${after.title}" (${code}); the next review is on ${formatForEmail(newReview)}.`;
    await notifyByEmail({
      ...base,
      to: [cust.email],
      subject: `POC ${code} — ${d.outcome === "Extended" ? "extended" : d.outcome === "Success" ? "approved" : "concluded"}`,
      body: [`Dear ${cust.contactName || cust.name},`, "", `We would like to inform you that ${line}`, "", "Summary:", d.decisionNotes, "", "Regards,", "Virtus Management Service Team"].join("\n"),
    });
  }

  let deal: { id: number; dealCode: string } | null = null;
  if (d.outcome === "Success" && d.createDeal) {
    const seq = await nextSequence(pipelineDeals.id);
    const [created] = await db
      .insert(pipelineDeals)
      .values({
        id: seq,
        dealCode: nextFormattedCode("PIP", seq),
        title: after.title,
        description: `From approved POC ${code}.\n\n${d.decisionNotes}`,
        stage: "Negotiation",
        dealValueIdr: d.dealValueIdr,
        probabilityPct: 60,
        customerId: after.customerId,
        partnerId: after.partnerId,
        productId: after.productId,
        ownerId: after.leadUserId ?? actorId,
      })
      .returning({ id: pipelineDeals.id, dealCode: pipelineDeals.dealCode });
    deal = created;
    await logActivity({ ...base, type: "Update", category: "Pipeline Deal", subject: `Pipeline deal ${created.dealCode} created from ${code}` });
  }
  return { item: serialize(after), deal };
}

// ---- Review date monitoring -----------------------------------------------------

/** Remind the lead 3 days before the review; alert lead + managers once it passes undecided. */
export async function runPocChecks(): Promise<{ reminded: number; overdue: number }> {
  const now = new Date();
  const soon = new Date(now.getTime() + POC_DUE_SOON_DAYS * 86_400_000);
  const overdueBefore = new Date(now.getTime() - 86_400_000);

  const [toRemind, toAlert] = await Promise.all([
    db
      .select()
      .from(pocRecords)
      .where(
        and(
          notInArray(pocRecords.outcome, FINISHED),
          isNull(pocRecords.reminderSentAt),
          isNotNull(pocRecords.targetReviewDate),
          gt(pocRecords.targetReviewDate, now),
          lte(pocRecords.targetReviewDate, soon)
        )
      ),
    db
      .select()
      .from(pocRecords)
      .where(
        and(
          notInArray(pocRecords.outcome, FINISHED),
          isNull(pocRecords.overdueNotifiedAt),
          isNotNull(pocRecords.targetReviewDate),
          lte(pocRecords.targetReviewDate, overdueBefore)
        )
      ),
  ]);
  if (toRemind.length === 0 && toAlert.length === 0) return { reminded: 0, overdue: 0 };

  let reminded = 0;
  for (const p of toRemind) {
    const [claimed] = await db
      .update(pocRecords)
      .set({ reminderSentAt: now })
      .where(and(eq(pocRecords.id, p.id), isNull(pocRecords.reminderSentAt)))
      .returning({ id: pocRecords.id });
    if (!claimed) continue;
    reminded += 1;
    const lead = await userContact(p.leadUserId);
    if (!lead) continue;
    await notifyByEmail({
      entityType: ENTITY,
      entityId: p.id,
      to: [lead.email],
      subject: `Reminder: ${p.pocCode} review ${formatForEmail(p.targetReviewDate)}`,
      body: `${p.pocCode} — ${p.title}\nStage: ${p.status}\nCurrent score: ${p.evaluationScore}%\n\nSuccess criteria:\n${p.successCriteria}`,
    });
  }

  const managers = toAlert.length ? await managerEmails() : [];
  let overdue = 0;
  for (const p of toAlert) {
    const [claimed] = await db
      .update(pocRecords)
      .set({ overdueNotifiedAt: now })
      .where(and(eq(pocRecords.id, p.id), isNull(pocRecords.overdueNotifiedAt)))
      .returning({ id: pocRecords.id });
    if (!claimed) continue;
    overdue += 1;
    const lead = await userContact(p.leadUserId);
    const late = formatDuration((now.getTime() - (p.targetReviewDate?.getTime() ?? now.getTime())) / 60_000);
    await logActivity({ entityType: ENTITY, entityId: p.id, type: "Update", category: "Overdue", subject: `${p.pocCode} review is overdue (${late})` });
    await notifyByEmail({
      entityType: ENTITY,
      entityId: p.id,
      to: [...new Set([...(lead ? [lead.email] : []), ...managers])],
      subject: `OVERDUE: ${p.pocCode} POC review not decided`,
      body: `${p.pocCode} — ${p.title}\nReview date: ${formatForEmail(p.targetReviewDate)}\nStage: ${p.status}\nLead: ${lead?.name ?? "Unassigned"}\n\nRecord a decision (Success / Extend / Drop) in VMS.`,
    });
  }
  return { reminded, overdue };
}
