import { desc, eq } from "drizzle-orm";
import { businessPartners, customers, db, implementations, products, serviceNumbers, users } from "@/db";
import { notFound, serialize, definedFields } from "@/server/http";
import type { ImplementationItem } from "@/shared/types";
import { implementationCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { getCommentCounts, nextFormattedCode, nextSequence, parseDateOrNull } from "./common";

type CreateInput = z.output<typeof implementationCreateSchema>;
type UpdateInput = Partial<CreateInput>;

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
    getCommentCounts("implementation"),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

export async function createImplementation(d: CreateInput, actorId: number) {
  const seq = await nextSequence(implementations.id);
  const [created] = await db
    .insert(implementations)
    .values({
      projectCode: nextFormattedCode("IMP", seq),
      title: d.title,
      description: d.description,
      status: d.status,
      progressPct: d.status === "Go-Live" ? 100 : d.progressPct,
      targetGoLive: parseDateOrNull(d.targetGoLive),
      milestones: d.milestones,
      blockers: d.blockers ?? null,
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      leadUserId: d.leadUserId ?? actorId,
    })
    .returning();
  return serialize(created);
}

export async function updateImplementation(id: number, d: UpdateInput) {
  const patch = {
    updatedAt: new Date(),
    // Moving to Go-Live completes progress unless a value was sent explicitly.
    ...(d.status === "Go-Live" && d.progressPct === undefined && { progressPct: 100 }),
    ...definedFields(d, [
      "title",
      "description",
      "status",
      "progressPct",
      "milestones",
      "blockers",
      "customerId",
      "partnerId",
      "serviceNumberId",
      "productId",
      "leadUserId",
    ] as const),
    ...(d.targetGoLive !== undefined && { targetGoLive: parseDateOrNull(d.targetGoLive) }),
  };
  const [updated] = await db.update(implementations).set(patch).where(eq(implementations.id, id)).returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deleteImplementation(id: number): Promise<void> {
  const [deleted] = await db.delete(implementations).where(eq(implementations.id, id)).returning();
  if (!deleted) throw notFound();
}
