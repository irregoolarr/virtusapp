import { desc, eq, sql } from "drizzle-orm";
import { businessPartners, customers, db, serviceNumbers, users } from "@/db";
import { notFound, serialize } from "@/server/http";
import type { CustomerItem, PartnerItem } from "@/shared/types";
import { customerCreateSchema, partnerCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { getCommentCounts, nextSequence } from "./common";

type CustomerInput = z.output<typeof customerCreateSchema>;
type PartnerInput = z.output<typeof partnerCreateSchema>;

// ---- Customers -------------------------------------------------------------

export async function listCustomers(): Promise<CustomerItem[]> {
  const [rows, srvCounts, commentMap] = await Promise.all([
    db
      .select({
        item: customers,
        managerName: users.name,
        managerJobTitle: users.jobTitle,
        managerAvatarColor: users.avatarColor,
      })
      .from(customers)
      .leftJoin(users, eq(customers.managerId, users.id))
      .orderBy(desc(customers.createdAt)),
    db
      .select({ customerId: serviceNumbers.customerId, count: sql<number>`count(*)::int` })
      .from(serviceNumbers)
      .groupBy(serviceNumbers.customerId),
    getCommentCounts("customer"),
  ]);
  const srvMap = new Map(srvCounts.map((s) => [s.customerId, s.count]));
  return rows.map(({ item, ...refs }) =>
    serialize({ ...item, ...refs, serviceCount: srvMap.get(item.id) ?? 0, commentCount: commentMap.get(item.id) ?? 0 })
  );
}

export async function createCustomer(d: CustomerInput, actorId: number) {
  const seq = await nextSequence(customers.id);
  const [created] = await db
    .insert(customers)
    .values({
      code: `CUST-${String(seq).padStart(3, "0")}`,
      name: d.name,
      industry: d.industry,
      tier: d.tier,
      status: d.status,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone ?? null,
      address: d.address ?? null,
      notes: d.notes ?? null,
      managerId: d.managerId ?? actorId,
    })
    .returning();
  return serialize(created);
}

export async function updateCustomer(id: number, d: Partial<CustomerInput>) {
  const [updated] = await db.update(customers).set({ ...d, updatedAt: new Date() }).where(eq(customers.id, id)).returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deleteCustomer(id: number): Promise<void> {
  const [deleted] = await db.delete(customers).where(eq(customers.id, id)).returning();
  if (!deleted) throw notFound();
}

// ---- Business partners -----------------------------------------------------

export async function listPartners(): Promise<PartnerItem[]> {
  const rows = await db.select().from(businessPartners).orderBy(desc(businessPartners.createdAt));
  return rows.map(serialize);
}

export async function createPartner(d: PartnerInput) {
  const seq = await nextSequence(businessPartners.id);
  const [created] = await db
    .insert(businessPartners)
    .values({
      code: `PTR-${String(seq).padStart(3, "0")}`,
      name: d.name,
      partnerType: d.partnerType,
      tier: d.tier,
      specialization: d.specialization,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone ?? null,
      escalationEmail: d.escalationEmail || null,
      address: d.address ?? null,
      status: d.status,
      notes: d.notes ?? null,
    })
    .returning();
  return serialize(created);
}

export async function updatePartner(id: number, d: Partial<PartnerInput>) {
  const [updated] = await db
    .update(businessPartners)
    .set({ ...d, escalationEmail: d.escalationEmail === "" ? null : d.escalationEmail, updatedAt: new Date() })
    .where(eq(businessPartners.id, id))
    .returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deletePartner(id: number): Promise<void> {
  const [deleted] = await db.delete(businessPartners).where(eq(businessPartners.id, id)).returning();
  if (!deleted) throw notFound();
}
