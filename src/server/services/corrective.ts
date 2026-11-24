import { desc, eq } from "drizzle-orm";
import { businessPartners, correctiveMaintenances, customers, db, products, serviceNumbers, users } from "@/db";
import { notFound, serialize, definedFields } from "@/server/http";
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

export async function createCorrective(d: CreateInput, actorId: number) {
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
      resolutionNotes: d.resolutionNotes ?? null,
      dueDate: parseDateOrNull(d.dueDate),
      resolvedAt: d.status === "Resolved" ? new Date() : null,
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      assigneeId: d.assigneeId ?? actorId,
    })
    .returning();
  return serialize(created);
}

export async function updateCorrective(id: number, d: UpdateInput) {
  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, [
      "title",
      "description",
      "severity",
      "rootCause",
      "resolutionNotes",
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
  return serialize(updated);
}

export async function deleteCorrective(id: number): Promise<void> {
  const [deleted] = await db.delete(correctiveMaintenances).where(eq(correctiveMaintenances.id, id)).returning();
  if (!deleted) throw notFound();
}
