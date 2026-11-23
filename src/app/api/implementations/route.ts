import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import {
  businessPartners,
  customers,
  db,
  implementations,
  products,
  serviceNumbers,
  users,
} from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, getCommentCounts, nextFormattedCode, parseDateOrNull } from "@/lib/api-helpers";
import { implementationCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("delivery:read");
  if ("error" in auth) return auth.error;

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

  const items = rows.map((r) => ({
    ...r.item,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerAddress: r.customerAddress,
    partnerName: r.partnerName,
    productName: r.productName,
    serviceCode: r.serviceCode,
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

  const parsed = implementationCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid implementation payload", parsed.error.flatten());
  }

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${implementations.id}), 0)::int` })
    .from(implementations);

  const d = parsed.data;
  const [created] = await db
    .insert(implementations)
    .values({
      projectCode: nextFormattedCode("IMP", maxId + 1),
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
      leadUserId: d.leadUserId ?? auth.user.id,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
