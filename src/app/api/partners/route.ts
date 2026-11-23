import { NextRequest, NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { businessPartners, db } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest } from "@/lib/api-helpers";
import { partnerCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("customers:read");
  if ("error" in auth) return auth.error;

  const items = await db
    .select()
    .from(businessPartners)
    .orderBy(desc(businessPartners.createdAt));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("customers:write");
  if ("error" in auth) return auth.error;

  const parsed = partnerCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid business partner input", parsed.error.flatten());
  }

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${businessPartners.id}), 0)::int` })
    .from(businessPartners);

  const d = parsed.data;
  const code = `PTR-${String(maxId + 1).padStart(3, "0")}`;

  const [created] = await db
    .insert(businessPartners)
    .values({
      code,
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

  return NextResponse.json({ item: created }, { status: 201 });
}
