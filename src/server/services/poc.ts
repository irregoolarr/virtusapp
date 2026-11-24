import { desc, eq } from "drizzle-orm";
import { businessPartners, customers, db, pocRecords, products, users } from "@/db";
import { notFound, serialize, definedFields } from "@/server/http";
import type { PocItem } from "@/shared/types";
import { pocCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { getCommentCounts, nextFormattedCode, nextSequence, parseDateOrNull } from "./common";

type CreateInput = z.output<typeof pocCreateSchema>;
type UpdateInput = Partial<CreateInput>;

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
    getCommentCounts("poc"),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

export async function createPoc(d: CreateInput, actorId: number) {
  const seq = await nextSequence(pocRecords.id);
  const [created] = await db
    .insert(pocRecords)
    .values({
      id: seq,
      pocCode: nextFormattedCode("POC", seq),
      title: d.title,
      description: d.description,
      status: d.status,
      // An approved POC with no explicit outcome counts as a success.
      outcome: d.status === "Approved" && d.outcome === "Pending" ? "Success" : d.outcome,
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
  return serialize(created);
}

export async function updatePoc(id: number, d: UpdateInput) {
  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, [
      "title",
      "description",
      "status",
      "outcome",
      "successCriteria",
      "evaluationScore",
      "customerId",
      "partnerId",
      "productId",
      "leadUserId",
    ] as const),
    ...(d.startDate !== undefined && { startDate: parseDateOrNull(d.startDate) }),
    ...(d.targetReviewDate !== undefined && { targetReviewDate: parseDateOrNull(d.targetReviewDate) }),
  };
  const [updated] = await db.update(pocRecords).set(patch).where(eq(pocRecords.id, id)).returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deletePoc(id: number): Promise<void> {
  const [deleted] = await db.delete(pocRecords).where(eq(pocRecords.id, id)).returning();
  if (!deleted) throw notFound();
}
