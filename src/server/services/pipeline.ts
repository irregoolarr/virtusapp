import { desc, eq } from "drizzle-orm";
import { businessPartners, customers, db, pipelineDeals, products, users } from "@/db";
import { notFound, serialize, definedFields } from "@/server/http";
import type { PipelineItem } from "@/shared/types";
import { pipelineCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { getCommentCounts, nextFormattedCode, nextSequence, parseDateOrNull } from "./common";

type CreateInput = z.output<typeof pipelineCreateSchema>;
type UpdateInput = Partial<CreateInput>;

export async function listPipeline(): Promise<PipelineItem[]> {
  const [rows, commentMap] = await Promise.all([
    db
      .select({
        item: pipelineDeals,
        customerName: customers.name,
        customerEmail: customers.contactEmail,
        customerAddress: customers.address,
        partnerName: businessPartners.name,
        productName: products.name,
        assigneeName: users.name,
        assigneeJobTitle: users.jobTitle,
        assigneeAvatarColor: users.avatarColor,
      })
      .from(pipelineDeals)
      .leftJoin(customers, eq(pipelineDeals.customerId, customers.id))
      .leftJoin(businessPartners, eq(pipelineDeals.partnerId, businessPartners.id))
      .leftJoin(products, eq(pipelineDeals.productId, products.id))
      .leftJoin(users, eq(pipelineDeals.ownerId, users.id))
      .orderBy(desc(pipelineDeals.createdAt)),
    getCommentCounts("pipeline"),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

export async function createDeal(d: CreateInput, actorId: number) {
  const seq = await nextSequence(pipelineDeals.id);
  const [created] = await db
    .insert(pipelineDeals)
    .values({
      id: seq,
      dealCode: nextFormattedCode("PIP", seq),
      title: d.title,
      description: d.description,
      stage: d.stage,
      dealValueIdr: d.dealValueIdr,
      probabilityPct: d.stage === "Deal Closed" ? 100 : d.probabilityPct,
      expectedCloseDate: parseDateOrNull(d.expectedCloseDate),
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      productId: d.productId ?? null,
      ownerId: d.ownerId ?? actorId,
    })
    .returning();
  return serialize(created);
}

export async function updateDeal(id: number, d: UpdateInput) {
  const patch = {
    updatedAt: new Date(),
    // Closing a deal sets probability to 100% unless a value was sent explicitly.
    ...(d.stage === "Deal Closed" && d.probabilityPct === undefined && { probabilityPct: 100 }),
    ...definedFields(d, [
      "title",
      "description",
      "stage",
      "dealValueIdr",
      "probabilityPct",
      "customerId",
      "partnerId",
      "productId",
      "ownerId",
    ] as const),
    ...(d.expectedCloseDate !== undefined && { expectedCloseDate: parseDateOrNull(d.expectedCloseDate) }),
  };
  const [updated] = await db.update(pipelineDeals).set(patch).where(eq(pipelineDeals.id, id)).returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deleteDeal(id: number): Promise<void> {
  const [deleted] = await db.delete(pipelineDeals).where(eq(pipelineDeals.id, id)).returning();
  if (!deleted) throw notFound();
}
