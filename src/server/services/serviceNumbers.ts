import { desc, eq } from "drizzle-orm";
import { businessPartners, customers, db, products, serviceNumbers, users } from "@/db";
import { definedFields, notFound, serialize } from "@/server/http";
import type { ServiceItem } from "@/shared/types";
import { serviceCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { parseDateOrNull } from "./common";

type CreateInput = z.output<typeof serviceCreateSchema>;

const normalizeNumber = (n: string) => n.trim().toUpperCase();

export async function listServiceNumbers(): Promise<ServiceItem[]> {
  const rows = await db
    .select({
      item: serviceNumbers,
      customerName: customers.name,
      customerEmail: customers.contactEmail,
      partnerName: businessPartners.name,
      productName: products.name,
      picName: users.name,
      picAvatarColor: users.avatarColor,
    })
    .from(serviceNumbers)
    .leftJoin(customers, eq(serviceNumbers.customerId, customers.id))
    .leftJoin(businessPartners, eq(serviceNumbers.partnerId, businessPartners.id))
    .leftJoin(products, eq(serviceNumbers.productId, products.id))
    .leftJoin(users, eq(serviceNumbers.picUserId, users.id))
    .orderBy(desc(serviceNumbers.createdAt));
  return rows.map(({ item, ...refs }) => serialize({ ...item, ...refs }));
}

export async function createServiceNumber(d: CreateInput, actorId: number) {
  const [created] = await db
    .insert(serviceNumbers)
    .values({
      serviceNumber: normalizeNumber(d.serviceNumber),
      title: d.title,
      category: d.category,
      slaTier: d.slaTier,
      status: d.status,
      monthlyFeeUsd: d.monthlyFeeUsd,
      startDate: parseDateOrNull(d.startDate) ?? new Date(),
      endDate: parseDateOrNull(d.endDate) ?? new Date(Date.now() + 365 * 86_400_000),
      customerId: d.customerId,
      partnerId: d.partnerId ?? null,
      productId: d.productId ?? null,
      picUserId: d.picUserId ?? actorId,
      siteLocation: d.siteLocation ?? null,
      notes: d.notes ?? null,
    })
    .returning();
  return serialize(created);
}

export async function updateServiceNumber(id: number, d: Partial<CreateInput>) {
  const start = d.startDate !== undefined ? parseDateOrNull(d.startDate) : undefined;
  const end = d.endDate !== undefined ? parseDateOrNull(d.endDate) : undefined;
  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, [
      "title",
      "category",
      "slaTier",
      "status",
      "monthlyFeeUsd",
      "customerId",
      "partnerId",
      "productId",
      "picUserId",
      "siteLocation",
      "notes",
    ] as const),
    ...(d.serviceNumber !== undefined && { serviceNumber: normalizeNumber(d.serviceNumber) }),
    // start/end dates are NOT NULL: ignore unparseable values instead of writing null.
    ...(start && { startDate: start }),
    ...(end && { endDate: end }),
  };
  const [updated] = await db.update(serviceNumbers).set(patch).where(eq(serviceNumbers.id, id)).returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deleteServiceNumber(id: number): Promise<void> {
  const [deleted] = await db.delete(serviceNumbers).where(eq(serviceNumbers.id, id)).returning();
  if (!deleted) throw notFound();
}
