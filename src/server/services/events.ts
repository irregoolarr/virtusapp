import { desc, eq } from "drizzle-orm";
import { db, emailAlertLogs, events, users } from "@/db";
import { definedFields, notFound, serialize } from "@/server/http";
import type { EventsResponse } from "@/shared/types";
import { eventCreateSchema } from "@/shared/schemas";
import type { z } from "zod";
import { sendAlertEmail } from "@/lib/mailer";
import { computeNextRunDate } from "@/lib/utils";
import { nextFormattedCode, nextSequence, parseDateOrNull } from "./common";

type CreateInput = z.output<typeof eventCreateSchema>;

/** First reminder fires `minutesBefore` ahead of the scheduled time. */
const reminderTime = (scheduledAt: Date, minutesBefore: number) => new Date(scheduledAt.getTime() - minutesBefore * 60_000);

export async function listEventsWithLogs(): Promise<EventsResponse> {
  const [eventRows, logRows] = await Promise.all([
    db
      .select({ item: events, createdByName: users.name })
      .from(events)
      .leftJoin(users, eq(events.createdById, users.id))
      .orderBy(events.nextRunAt),
    db.select().from(emailAlertLogs).orderBy(desc(emailAlertLogs.sentAt)).limit(50),
  ]);
  return {
    items: eventRows.map(({ item, createdByName }) => serialize({ ...item, createdByName })),
    logs: logRows.map(serialize),
  };
}

export async function createEvent(d: CreateInput, actorId: number) {
  const seq = await nextSequence(events.id);
  const scheduledAt = parseDateOrNull(d.scheduledAt) ?? new Date();
  const [created] = await db
    .insert(events)
    .values({
      eventCode: nextFormattedCode("EVT", seq),
      title: d.title,
      description: d.description,
      eventType: d.eventType,
      linkedModule: d.linkedModule,
      linkedRefCode: d.linkedRefCode ?? null,
      scheduledAt,
      nextRunAt: reminderTime(scheduledAt, d.reminderMinutesBefore),
      recurrence: d.recurrence,
      reminderMinutesBefore: d.reminderMinutesBefore,
      recipientEmails: d.recipientEmails,
      emailSubject: d.emailSubject,
      emailBody: d.emailBody,
      status: d.status,
      createdById: actorId,
    })
    .returning();
  return serialize(created);
}

export async function updateEvent(id: number, d: Partial<CreateInput>) {
  const scheduledAt = d.scheduledAt !== undefined ? parseDateOrNull(d.scheduledAt) : null;
  const patch = {
    updatedAt: new Date(),
    ...definedFields(d, [
      "title",
      "description",
      "eventType",
      "linkedModule",
      "linkedRefCode",
      "recurrence",
      "reminderMinutesBefore",
      "recipientEmails",
      "emailSubject",
      "emailBody",
      "status",
    ] as const),
    ...(scheduledAt && { scheduledAt, nextRunAt: reminderTime(scheduledAt, d.reminderMinutesBefore ?? 0) }),
  };
  const [updated] = await db.update(events).set(patch).where(eq(events.id, id)).returning();
  if (!updated) throw notFound();
  return serialize(updated);
}

export async function deleteEvent(id: number): Promise<void> {
  const [deleted] = await db.delete(events).where(eq(events.id, id)).returning();
  if (!deleted) throw notFound();
}

/** Send one event's alert immediately and roll its schedule forward. */
export async function dispatchEventNow(id: number) {
  const [evt] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!evt) throw notFound("Event not found");

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
  return dispatch;
}

export { processDueEvents } from "@/lib/mailer";
