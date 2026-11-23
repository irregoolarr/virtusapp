import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, serviceNumbers } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseDateOrNull, parseNumericId } from "@/lib/api-helpers";
import { serviceCreateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("services:write");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const parsed = serviceCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid service update", parsed.error.flatten());
  }

  const d = parsed.data;
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (d.serviceNumber !== undefined) updatePayload.serviceNumber = d.serviceNumber.trim().toUpperCase();
  if (d.title !== undefined) updatePayload.title = d.title;
  if (d.category !== undefined) updatePayload.category = d.category;
  if (d.slaTier !== undefined) updatePayload.slaTier = d.slaTier;
  if (d.status !== undefined) updatePayload.status = d.status;
  if (d.monthlyFeeUsd !== undefined) updatePayload.monthlyFeeUsd = d.monthlyFeeUsd;
  if (d.startDate !== undefined) updatePayload.startDate = parseDateOrNull(d.startDate);
  if (d.endDate !== undefined) updatePayload.endDate = parseDateOrNull(d.endDate);
  if (d.customerId !== undefined) updatePayload.customerId = d.customerId;
  if (d.partnerId !== undefined) updatePayload.partnerId = d.partnerId;
  if (d.productId !== undefined) updatePayload.productId = d.productId;
  if (d.picUserId !== undefined) updatePayload.picUserId = d.picUserId;
  if (d.siteLocation !== undefined) updatePayload.siteLocation = d.siteLocation;
  if (d.notes !== undefined) updatePayload.notes = d.notes;

  const [updated] = await db
    .update(serviceNumbers)
    .set(updatePayload)
    .where(eq(serviceNumbers.id, id))
    .returning();

  if (!updated) return notFound();
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("services:delete");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const [deleted] = await db
    .delete(serviceNumbers)
    .where(eq(serviceNumbers.id, id))
    .returning();

  if (!deleted) return notFound();
  return NextResponse.json({ ok: true });
}
