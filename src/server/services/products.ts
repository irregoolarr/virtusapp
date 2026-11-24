import { desc, eq, sql } from "drizzle-orm";
import { businessPartners, db, products, serviceNumbers } from "@/db";
import { notFound, serialize } from "@/server/http";
import type { ProductItem } from "@/shared/types";
import { productCreateSchema } from "@/shared/schemas";
import type { z } from "zod";

type CreateInput = z.output<typeof productCreateSchema>;

export async function listProducts(): Promise<ProductItem[]> {
  const [rows, deploymentCounts] = await Promise.all([
    db
      .select({ item: products, partnerName: businessPartners.name })
      .from(products)
      .leftJoin(businessPartners, eq(products.partnerId, businessPartners.id))
      .orderBy(desc(products.createdAt)),
    db
      .select({ productId: serviceNumbers.productId, count: sql<number>`count(*)::int` })
      .from(serviceNumbers)
      .groupBy(serviceNumbers.productId),
  ]);
  const countMap = new Map(deploymentCounts.map((d) => [d.productId, d.count]));
  return rows.map(({ item, partnerName }) =>
    serialize({ ...item, partnerName, activeDeployments: countMap.get(item.id) ?? 0 })
  );
}

export async function createProduct(d: CreateInput) {
  const [created] = await db
    .insert(products)
    .values({
      sku: d.sku.trim().toUpperCase(),
      name: d.name,
      category: d.category,
      vendorName: d.vendorName,
      partnerId: d.partnerId ?? null,
      description: d.description,
      slaTargetHours: d.slaTargetHours,
      pricingModel: d.pricingModel,
      unitPriceIdr: d.unitPriceIdr,
      status: d.status,
    })
    .returning();
  return serialize(created);
}

export async function updateProduct(id: number, d: Partial<CreateInput>) {
  const [updated] = await db.update(products).set({ ...d, updatedAt: new Date() }).where(eq(products.id, id)).returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deleteProduct(id: number): Promise<void> {
  const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
  if (!deleted) throw notFound();
}
