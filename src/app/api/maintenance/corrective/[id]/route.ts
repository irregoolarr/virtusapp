import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { correctiveMaintenances, db } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseDateOrNull, parseNumericId } from "@/lib/api-helpers";
import { correctiveCreateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("maintenance:write");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const parsed = correctiveCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid update payload", parsed.error.flatten());
  }

  const d = parsed.data;
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (d.title !== undefined) updatePayload.title = d.title;
  if (d.description !== undefined) updatePayload.description = d.description;
  if (d.severity !== undefined) updatePayload.severity = d.severity;
  if (d.status !== undefined) {
    updatePayload.status = d.status;
    updatePayload.resolvedAt = d.status === "Resolved" ? new Date() : null;
  }
  if (d.rootCause !== undefined) updatePayload.rootCause = d.rootCause;
  if (d.resolutionNotes !== undefined) updatePayload.resolutionNotes = d.resolutionNotes;
  if (d.dueDate !== undefined) updatePayload.dueDate = parseDateOrNull(d.dueDate);
  if (d.customerId !== undefined) updatePayload.customerId = d.customerId;
  if (d.partnerId !== undefined) updatePayload.partnerId = d.partnerId;
  if (d.serviceNumberId !== undefined) updatePayload.serviceNumberId = d.serviceNumberId;
  if (d.productId !== undefined) updatePayload.productId = d.productId;
  if (d.assigneeId !== undefined) updatePayload.assigneeId = d.assigneeId;

  const [updated] = await db
    .update(correctiveMaintenances)
    .set(updatePayload)
    .where(eq(correctiveMaintenances.id, id))
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
    .delete(correctiveMaintenances)
    .where(eq(correctiveMaintenances.id, id))
    .returning();

  if (!deleted) return notFound();
  return NextResponse.json({ ok: true });
}
