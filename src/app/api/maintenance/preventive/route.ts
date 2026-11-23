import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import {
  customers,
  db,
  preventiveMaintenances,
  products,
  serviceNumbers,
  users,
} from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, getCommentCounts, nextFormattedCode, parseDateOrNull } from "@/lib/api-helpers";
import { preventiveCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("maintenance:read");
  if ("error" in auth) return auth.error;

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

  const items = rows.map((r) => ({
    ...r.item,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerAddress: r.customerAddress,
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

  const parsed = preventiveCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid preventive maintenance input", parsed.error.flatten());
  }

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${preventiveMaintenances.id}), 0)::int` })
    .from(preventiveMaintenances);

  const d = parsed.data;
  const scheduledDate = parseDateOrNull(d.scheduledDate) ?? new Date();

  const [created] = await db
    .insert(preventiveMaintenances)
    .values({
      planCode: nextFormattedCode("PM", maxId + 1),
      title: d.title,
      description: d.description,
      frequency: d.frequency,
      status: d.status,
      scheduledDate,
      lastCompletedAt: d.status === "Completed" ? new Date() : null,
      checklist: d.checklist,
      customerId: d.customerId ?? null,
      serviceNumberId: d.serviceNumberId ?? null,
      productId: d.productId ?? null,
      assigneeId: d.assigneeId ?? auth.user.id,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
