import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, implementations } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseDateOrNull, parseNumericId } from "@/lib/api-helpers";
import { implementationCreateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("delivery:write");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const parsed = implementationCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid update payload", parsed.error.flatten());
  }

  const d = parsed.data;
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (d.title !== undefined) updatePayload.title = d.title;
  if (d.description !== undefined) updatePayload.description = d.description;
  if (d.status !== undefined) {
    updatePayload.status = d.status;
    if (d.status === "Go-Live" && d.progressPct === undefined) {
      updatePayload.progressPct = 100;
    }
  }
  if (d.progressPct !== undefined) updatePayload.progressPct = d.progressPct;
  if (d.targetGoLive !== undefined) updatePayload.targetGoLive = parseDateOrNull(d.targetGoLive);
  if (d.milestones !== undefined) updatePayload.milestones = d.milestones;
  if (d.blockers !== undefined) updatePayload.blockers = d.blockers;
  if (d.customerId !== undefined) updatePayload.customerId = d.customerId;
  if (d.partnerId !== undefined) updatePayload.partnerId = d.partnerId;
  if (d.serviceNumberId !== undefined) updatePayload.serviceNumberId = d.serviceNumberId;
  if (d.productId !== undefined) updatePayload.productId = d.productId;
  if (d.leadUserId !== undefined) updatePayload.leadUserId = d.leadUserId;

  const [updated] = await db
    .update(implementations)
    .set(updatePayload)
    .where(eq(implementations.id, id))
    .returning();

  if (!updated) return notFound();
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("delivery:delete");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const [deleted] = await db
    .delete(implementations)
    .where(eq(implementations.id, id))
    .returning();

  if (!deleted) return notFound();
  return NextResponse.json({ ok: true });
}
