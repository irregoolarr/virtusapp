import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { businessPartners, db, products, serviceNumbers } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest } from "@/lib/api-helpers";
import { productCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("products:read");
  if ("error" in auth) return auth.error;

  const [rows, deploymentCounts] = await Promise.all([
    db
      .select({
        item: products,
        partnerName: businessPartners.name,
      })
      .from(products)
      .leftJoin(businessPartners, eq(products.partnerId, businessPartners.id))
      .orderBy(desc(products.createdAt)),
    db
      .select({
        productId: serviceNumbers.productId,
        count: sql<number>`count(*)::int`,
      })
      .from(serviceNumbers)
      .groupBy(serviceNumbers.productId),
  ]);

  const countMap = new Map(deploymentCounts.map((d) => [d.productId, d.count]));

  const items = rows.map((r) => ({
    ...r.item,
    partnerName: r.partnerName,
    activeDeployments: countMap.get(r.item.id) ?? 0,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("products:write");
  if ("error" in auth) return auth.error;

  const parsed = productCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid product input", parsed.error.flatten());
  }

  const d = parsed.data;
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
      unitPriceUsd: d.unitPriceUsd,
      status: d.status,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
