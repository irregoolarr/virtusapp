import { desc, eq } from "drizzle-orm";
import { customers, db, preventiveMaintenances, products, serviceNumbers, users } from "@/db";
import { notFound, serialize, definedFields } from "@/server/http";
import type { PreventiveItem } from "@/shared/types";
import { preventiveCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { getCommentCounts, nextFormattedCode, nextSequence, parseDateOrNull } from "./common";

type CreateInput = z.output<typeof preventiveCreateSchema>;
type UpdateInput = Partial<CreateInput>;

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
    getCommentCounts("preventive"),
  ]);
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs, commentCount: commentMap.get(item.id) ?? 0 }));
}

export async function createPreventive(d: CreateInput, actorId: number) {
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
      scheduledDate: parseDateOrNull(d.scheduledDate) ?? new Date(),
      lastCompletedAt: d.status === "Completed" ? new Date() : null,
      checklist: d.checklist,
      customerId: d.customerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      assigneeId: d.assigneeId ?? actorId,
    })
    .returning();
  return serialize(created);
}

export async function updatePreventive(id: number, d: UpdateInput) {
  const scheduled = d.scheduledDate !== undefined ? parseDateOrNull(d.scheduledDate) : null;
  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, [
      "title",
      "description",
      "frequency",
      "checklist",
      "customerId",
      "serviceNumberId",
      "productId",
      "assigneeId",
    ] as const),
    ...(d.status !== undefined && { status: d.status, lastCompletedAt: d.status === "Completed" ? new Date() : null }),
    ...(scheduled && { scheduledDate: scheduled }),
  };
  const [updated] = await db.update(preventiveMaintenances).set(patch).where(eq(preventiveMaintenances.id, id)).returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deletePreventive(id: number): Promise<void> {
  const [deleted] = await db.delete(preventiveMaintenances).where(eq(preventiveMaintenances.id, id)).returning();
  if (!deleted) throw notFound();
}
