import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, events } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { processDueEvents, sendAlertEmail } from "@/lib/mailer";
import { computeNextRunDate } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("events:dispatch");
  if ("error" in auth) return auth.error;

  let body: { eventId?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.eventId) {
    const [evt] = await db.select().from(events).where(eq(events.id, body.eventId)).limit(1);
    if (!evt) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const dispatch = await sendAlertEmail({
      eventId: evt.id,
      recipients: evt.recipientEmails,
      subject: evt.emailSubject || `[VirtusMS ${evt.eventType}] ${evt.title}`,
      body: evt.emailBody || evt.description,
    });

    const now = new Date();
    const isRecurring = evt.recurrence !== "Once";
    await db
      .update(events)
      .set({
        lastSentAt: now,
        status: dispatch.status === "Failed" ? "Failed" : isRecurring ? "Scheduled" : "Sent",
        nextRunAt: isRecurring ? computeNextRunDate(now, evt.recurrence) : evt.nextRunAt,
        updatedAt: now,
      })
      .where(eq(events.id, evt.id));

    return NextResponse.json({ dispatched: dispatch });
  }

  const result = await processDueEvents();
  return NextResponse.json(result);
}
