import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import {
  businessPartners,
  correctiveMaintenances,
  customers,
  db,
  products,
  serviceNumbers,
  users,
} from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, getCommentCounts, nextFormattedCode, parseDateOrNull } from "@/lib/api-helpers";
import { correctiveCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("maintenance:read");
  if ("error" in auth) return auth.error;

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
  const auth = await requireApiAuth("maintenance:write");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const parsed = correctiveCreateSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid corrective maintenance input", parsed.error.flatten());
  }

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${correctiveMaintenances.id}), 0)::int` })
    .from(correctiveMaintenances);

  const ticketCode = nextFormattedCode("CM", maxId + 1);
  const d = parsed.data;
  const resolvedAt = d.status === "Resolved" ? new Date() : null;

  const [created] = await db
    .insert(correctiveMaintenances)
    .values({
      ticketCode,
      title: d.title,
      description: d.description,
      severity: d.severity,
      status: d.status,
      rootCause: d.rootCause ?? null,
      resolutionNotes: d.resolutionNotes ?? null,
      dueDate: parseDateOrNull(d.dueDate),
      resolvedAt,
      customerId: d.customerId ?? null,
      partnerId: d.partnerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      assigneeId: d.assigneeId ?? auth.user.id,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
