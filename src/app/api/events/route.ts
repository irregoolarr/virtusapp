import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db, emailAlertLogs, events, users } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, nextFormattedCode, parseDateOrNull } from "@/lib/api-helpers";
import { eventCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("events:read");
  if ("error" in auth) return auth.error;

  const [eventRows, logRows] = await Promise.all([
    db
      .select({
        item: events,
        createdByName: users.name,
      })
      .from(events)
      .leftJoin(users, eq(events.createdById, users.id))
      .orderBy(events.nextRunAt),
    db
      .select()
      .from(emailAlertLogs)
      .orderBy(desc(emailAlertLogs.sentAt))
      .limit(50),
  ]);

  const items = eventRows.map((r) => ({
    ...r.item,
    createdByName: r.createdByName,
  }));

  return NextResponse.json({ items, logs: logRows });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("events:write");
  if ("error" in auth) return auth.error;

  const parsed = eventCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid event schedule payload", parsed.error.flatten());
  }

  const [{ maxId }] = await db
    .select({ maxId: sql<number>`COALESCE(MAX(${events.id}), 0)::int` })
    .from(events);

  const d = parsed.data;
  const scheduledAt = parseDateOrNull(d.scheduledAt) ?? new Date();
  const nextRunAt = new Date(scheduledAt.getTime() - d.reminderMinutesBefore * 60_000);

  const [created] = await db
    .insert(events)
    .values({
      eventCode: nextFormattedCode("EVT", maxId + 1),
      title: d.title,
      description: d.description,
      eventType: d.eventType,
      linkedModule: d.linkedModule,
      linkedRefCode: d.linkedRefCode ?? null,
      scheduledAt,
      nextRunAt,
      recurrence: d.recurrence,
      reminderMinutesBefore: d.reminderMinutesBefore,
      recipientEmails: d.recipientEmails,
      emailSubject: d.emailSubject,
      emailBody: d.emailBody,
      status: d.status,
      createdById: auth.user.id,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
