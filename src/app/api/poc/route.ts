import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { businessPartners, customers, db, pocRecords, products, users } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, getCommentCounts, nextFormattedCode, parseDateOrNull } from "@/lib/api-helpers";
import { pocCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("delivery:read");
  if ("error" in auth) return auth.error;

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
  const auth = await requireApiAuth("delivery:write");
  if ("error" in auth) return auth.error;

  const parsed = pocCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid POC payload", parsed.error.flatten());
  }

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${pocRecords.id}), 0)::int` })
    .from(pocRecords);

  const d = parsed.data;
  const [created] = await db
    .insert(pocRecords)
    .values({
      pocCode: nextFormattedCode("POC", maxId + 1),
      title: d.title,
      description: d.description,
      status: d.status,
      outcome: d.status === "Approved" && d.outcome === "Pending" ? "Success" : d.outcome,
      successCriteria: d.successCriteria,
      evaluationScore: d.evaluationScore,
      startDate: parseDateOrNull(d.startDate) ?? new Date(),
      targetReviewDate: parseDateOrNull(d.targetReviewDate),
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      productId: d.productId ?? null,
      leadUserId: d.leadUserId ?? auth.user.id,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
