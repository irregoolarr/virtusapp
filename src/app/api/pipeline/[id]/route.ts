import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, pipelineDeals } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseDateOrNull, parseNumericId } from "@/lib/api-helpers";
import { pipelineCreateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("pipeline:write");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const parsed = pipelineCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid update payload", parsed.error.flatten());
  }

  const d = parsed.data;
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (d.title !== undefined) updatePayload.title = d.title;
  if (d.description !== undefined) updatePayload.description = d.description;
  if (d.stage !== undefined) {
    updatePayload.stage = d.stage;
    if (d.stage === "Deal Closed" && d.probabilityPct === undefined) {
      updatePayload.probabilityPct = 100;
    }
  }
  if (d.dealValueUsd !== undefined) updatePayload.dealValueUsd = d.dealValueUsd;
  if (d.probabilityPct !== undefined) updatePayload.probabilityPct = d.probabilityPct;
  if (d.expectedCloseDate !== undefined) {
    updatePayload.expectedCloseDate = parseDateOrNull(d.expectedCloseDate);
  }
  if (d.customerId !== undefined) updatePayload.customerId = d.customerId;
  if (d.partnerId !== undefined) updatePayload.partnerId = d.partnerId;
  if (d.productId !== undefined) updatePayload.productId = d.productId;
  if (d.ownerId !== undefined) updatePayload.ownerId = d.ownerId;

  const [updated] = await db
    .update(pipelineDeals)
    .set(updatePayload)
    .where(eq(pipelineDeals.id, id))
    .returning();

  if (!updated) return notFound();
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("pipeline:delete");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const [deleted] = await db
    .delete(pipelineDeals)
    .where(eq(pipelineDeals.id, id))
    .returning();

  if (!deleted) return notFound();
  return NextResponse.json({ ok: true });
}
