import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import {
  businessPartners,
  customers,
  db,
  products,
  serviceNumbers,
  users,
} from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, parseDateOrNull } from "@/lib/api-helpers";
import { serviceCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("services:read");
  if ("error" in auth) return auth.error;

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

  const items = rows.map((r) => ({
    ...r.item,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    partnerName: r.partnerName,
    productName: r.productName,
    picName: r.picName,
    picAvatarColor: r.picAvatarColor,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("services:write");
  if ("error" in auth) return auth.error;

  const parsed = serviceCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid service number input", parsed.error.flatten());
  }

  const d = parsed.data;
  const startDate = parseDateOrNull(d.startDate) ?? new Date();
  const endDate = parseDateOrNull(d.endDate) ?? new Date(Date.now() + 365 * 86400_000);

  const [created] = await db
    .insert(serviceNumbers)
    .values({
      serviceNumber: d.serviceNumber.trim().toUpperCase(),
      title: d.title,
      category: d.category,
      slaTier: d.slaTier,
      status: d.status,
      monthlyFeeUsd: d.monthlyFeeUsd,
      startDate,
      endDate,
      customerId: d.customerId,
      partnerId: d.partnerId ?? null,
      productId: d.productId ?? null,
      picUserId: d.picUserId ?? auth.user.id,
      siteLocation: d.siteLocation ?? null,
      notes: d.notes ?? null,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
