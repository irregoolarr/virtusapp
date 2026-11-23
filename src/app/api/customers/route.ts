import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { customers, db, serviceNumbers, users } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, getCommentCounts, nextFormattedCode } from "@/lib/api-helpers";
import { customerCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("customers:read");
  if ("error" in auth) return auth.error;

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
      .select({
        customerId: serviceNumbers.customerId,
        count: sql<number>`count(*)::int`,
      })
      .from(serviceNumbers)
      .groupBy(serviceNumbers.customerId),
    getCommentCounts("customer"),
  ]);

  const srvMap = new Map(srvCounts.map((s) => [s.customerId, s.count]));

  const items = rows.map((r) => ({
    ...r.item,
    managerName: r.managerName,
    managerJobTitle: r.managerJobTitle,
    managerAvatarColor: r.managerAvatarColor,
    serviceCount: srvMap.get(r.item.id) ?? 0,
    commentCount: commentMap.get(r.item.id) ?? 0,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("customers:write");
  if ("error" in auth) return auth.error;

  const parsed = customerCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid customer input", parsed.error.flatten());
  }

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${customers.id}), 0)::int` })
    .from(customers);

  const d = parsed.data;
  const code = `CUST-${String(maxId + 1).padStart(3, "0")}`;

  const [created] = await db
    .insert(customers)
    .values({
      code,
      name: d.name,
      industry: d.industry,
      tier: d.tier,
      status: d.status,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone ?? null,
      address: d.address ?? null,
      notes: d.notes ?? null,
      managerId: d.managerId ?? auth.user.id,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
