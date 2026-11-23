import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { businessPartners, customers, db, pipelineDeals, products, users } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, getCommentCounts, nextFormattedCode, parseDateOrNull } from "@/lib/api-helpers";
import { pipelineCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("pipeline:read");
  if ("error" in auth) return auth.error;

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

  const items = rows.map((r) => ({
    ...r.item,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerAddress: r.customerAddress,
    partnerName: r.partnerName,
    productName: r.productName,
    assigneeName: r.assigneeName,
    assigneeJobTitle: r.assigneeJobTitle,
    assigneeAvatarColor: r.assigneeAvatarColor,
    commentCount: commentMap.get(r.item.id) ?? 0,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("pipeline:write");
  if ("error" in auth) return auth.error;

  const parsed = pipelineCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid pipeline deal input", parsed.error.flatten());
  }

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${pipelineDeals.id}), 0)::int` })
    .from(pipelineDeals);

  const d = parsed.data;
  const [created] = await db
    .insert(pipelineDeals)
    .values({
      dealCode: nextFormattedCode("PIP", maxId + 1),
      title: d.title,
      description: d.description,
      stage: d.stage,
      dealValueUsd: d.dealValueUsd,
      probabilityPct: d.stage === "Deal Closed" ? 100 : d.probabilityPct,
      expectedCloseDate: parseDateOrNull(d.expectedCloseDate),
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      productId: d.productId ?? null,
      ownerId: d.ownerId ?? auth.user.id,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
