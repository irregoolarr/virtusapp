import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, preventiveMaintenances } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseDateOrNull, parseNumericId } from "@/lib/api-helpers";
import { preventiveCreateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("maintenance:write");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const parsed = preventiveCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid update payload", parsed.error.flatten());
  }

  const d = parsed.data;
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (d.title !== undefined) updatePayload.title = d.title;
  if (d.description !== undefined) updatePayload.description = d.description;
  if (d.frequency !== undefined) updatePayload.frequency = d.frequency;
  if (d.status !== undefined) {
    updatePayload.status = d.status;
    updatePayload.lastCompletedAt = d.status === "Completed" ? new Date() : null;
  }
  if (d.scheduledDate !== undefined) {
    const dt = parseDateOrNull(d.scheduledDate);
    if (dt) updatePayload.scheduledDate = dt;
  }
  if (d.checklist !== undefined) updatePayload.checklist = d.checklist;
  if (d.customerId !== undefined) updatePayload.customerId = d.customerId;
  if (d.serviceNumberId !== undefined) updatePayload.serviceNumberId = d.serviceNumberId;
  if (d.productId !== undefined) updatePayload.productId = d.productId;
  if (d.assigneeId !== undefined) updatePayload.assigneeId = d.assigneeId;

  const [updated] = await db
    .update(preventiveMaintenances)
    .set(updatePayload)
    .where(eq(preventiveMaintenances.id, id))
    .returning();

  if (!updated) return notFound();
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("maintenance:delete");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const [deleted] = await db
    .delete(preventiveMaintenances)
    .where(eq(preventiveMaintenances.id, id))
    .returning();

  if (!deleted) return notFound();
  return NextResponse.json({ ok: true });
}
