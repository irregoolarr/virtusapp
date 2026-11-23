import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, events } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseDateOrNull, parseNumericId } from "@/lib/api-helpers";
import { eventCreateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("events:write");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const parsed = eventCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid event update", parsed.error.flatten());
  }

  const d = parsed.data;
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (d.title !== undefined) updatePayload.title = d.title;
  if (d.description !== undefined) updatePayload.description = d.description;
  if (d.eventType !== undefined) updatePayload.eventType = d.eventType;
  if (d.linkedModule !== undefined) updatePayload.linkedModule = d.linkedModule;
  if (d.linkedRefCode !== undefined) updatePayload.linkedRefCode = d.linkedRefCode;
  if (d.recurrence !== undefined) updatePayload.recurrence = d.recurrence;
  if (d.reminderMinutesBefore !== undefined) {
    updatePayload.reminderMinutesBefore = d.reminderMinutesBefore;
  }
  if (d.recipientEmails !== undefined) updatePayload.recipientEmails = d.recipientEmails;
  if (d.emailSubject !== undefined) updatePayload.emailSubject = d.emailSubject;
  if (d.emailBody !== undefined) updatePayload.emailBody = d.emailBody;
  if (d.status !== undefined) updatePayload.status = d.status;
  if (d.scheduledAt !== undefined) {
    const dt = parseDateOrNull(d.scheduledAt);
    if (dt) {
      updatePayload.scheduledAt = dt;
      const mins = d.reminderMinutesBefore ?? 0;
      updatePayload.nextRunAt = new Date(dt.getTime() - mins * 60_000);
    }
  }

  const [updated] = await db
    .update(events)
    .set(updatePayload)
    .where(eq(events.id, id))
    .returning();

  if (!updated) return notFound();
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("events:delete");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const [deleted] = await db
    .delete(events)
    .where(eq(events.id, id))
    .returning();

  if (!deleted) return notFound();
  return NextResponse.json({ ok: true });
}
