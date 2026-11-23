import nodemailer from "nodemailer";
import { and, eq, lte } from "drizzle-orm";
import { appSettings, db, emailAlertLogs, events, users } from "@/db";
import { computeNextRunDate } from "./utils";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  defaultAlertEmail: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, "smtp_config"))
    .limit(1);

  const stored = (row?.value ?? {}) as Partial<SmtpConfig>;
  return {
    host: String(stored.host ?? process.env.SMTP_HOST ?? ""),
    port: Number(stored.port ?? process.env.SMTP_PORT ?? 587),
    secure: Boolean(stored.secure ?? (process.env.SMTP_SECURE === "true")),
    user: String(stored.user ?? process.env.SMTP_USER ?? ""),
    pass: String(stored.pass ?? process.env.SMTP_PASS ?? ""),
    from: String(stored.from ?? process.env.SMTP_FROM ?? "VirtusMS Alerts <alerts@virtusms.local>"),
    defaultAlertEmail: String(stored.defaultAlertEmail ?? "noc@virtusms.io"),
  };
}

export async function sendAlertEmail(params: {
  eventId?: number | null;
  recipients: string[];
  subject: string;
  body: string;
}): Promise<{
  logId: number;
  deliveryMode: "smtp" | "sandbox_outbox";
  status: "Sent" | "Simulated" | "Failed";
  messageId: string | null;
  errorMessage: string | null;
}> {
  const smtp = await getSmtpConfig();
  const cleanRecipients = params.recipients.map((e) => e.trim()).filter(Boolean);
  const targets = cleanRecipients.length > 0 ? cleanRecipients : [smtp.defaultAlertEmail];

  const html = `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; color: #18181A; max-width: 600px; margin: 0 auto; border: 1px solid #E8E8E2; border-radius: 12px; overflow: hidden;">
      <div style="background: #F3F3EB; padding: 20px 24px; border-bottom: 1px solid #E8E8E2;">
        <div style="font-size: 12px; color: #6B6B70; text-transform: uppercase; letter-spacing: 0.06em;">VirtusMS Alert & Reminder</div>
        <h2 style="margin: 6px 0 0; font-size: 18px; color: #18181A;">${escapeHtml(params.subject)}</h2>
      </div>
      <div style="padding: 24px; background: #FFFFFF; line-height: 1.6; font-size: 14px; white-space: pre-wrap;">${escapeHtml(params.body)}</div>
      <div style="padding: 14px 24px; background: #FAF9F5; border-top: 1px solid #ECECE8; font-size: 12px; color: #8E8E93;">
        Dispatched by VirtusMS Managed Services Platform · ${new Date().toISOString()}
      </div>
    </div>
  `;

  if (!smtp.host) {
    const simId = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [log] = await db
      .insert(emailAlertLogs)
      .values({
        eventId: params.eventId ?? null,
        recipientEmails: targets,
        subject: params.subject,
        bodyPreview: params.body,
        deliveryMode: "sandbox_outbox",
        status: "Simulated",
        messageId: simId,
      })
      .returning();

    return {
      logId: log.id,
      deliveryMode: "sandbox_outbox",
      status: "Simulated",
      messageId: simId,
      errorMessage: null,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      connectionTimeout: 8000,
    });

    const info = await transporter.sendMail({
      from: smtp.from,
      to: targets.join(", "),
      subject: params.subject,
      text: params.body,
      html,
    });

    const [log] = await db
      .insert(emailAlertLogs)
      .values({
        eventId: params.eventId ?? null,
        recipientEmails: targets,
        subject: params.subject,
        bodyPreview: params.body,
        deliveryMode: "smtp",
        status: "Sent",
        messageId: info.messageId ?? null,
      })
      .returning();

    return {
      logId: log.id,
      deliveryMode: "smtp",
      status: "Sent",
      messageId: info.messageId ?? null,
      errorMessage: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP dispatch error";
    const [log] = await db
      .insert(emailAlertLogs)
      .values({
        eventId: params.eventId ?? null,
        recipientEmails: targets,
        subject: params.subject,
        bodyPreview: params.body,
        deliveryMode: "smtp",
        status: "Failed",
        errorMessage: msg,
      })
      .returning();

    return {
      logId: log.id,
      deliveryMode: "smtp",
      status: "Failed",
      messageId: null,
      errorMessage: msg,
    };
  }
}

let processingDue = false;

export async function processDueEvents(): Promise<{
  processedCount: number;
  logs: Array<{ eventId: number; eventCode: string; status: string; deliveryMode: string }>;
}> {
  if (processingDue) {
    return { processedCount: 0, logs: [] };
  }
  processingDue = true;
  const results: Array<{ eventId: number; eventCode: string; status: string; deliveryMode: string }> = [];

  try {
    const now = new Date();
    const dueEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.status, "Scheduled"), lte(events.nextRunAt, now)));

    if (dueEvents.length === 0) {
      return { processedCount: 0, logs: [] };
    }

    const activeUsers = await db.select({ email: users.email }).from(users).where(eq(users.isActive, true));
    const fallbackEmails = activeUsers.slice(0, 2).map((u) => u.email);

    for (const evt of dueEvents) {
      const recipients =
        Array.isArray(evt.recipientEmails) && evt.recipientEmails.length > 0
          ? evt.recipientEmails
          : fallbackEmails;

      const dispatch = await sendAlertEmail({
        eventId: evt.id,
        recipients,
        subject: evt.emailSubject || `[VirtusMS ${evt.eventType}] ${evt.title}`,
        body: evt.emailBody || evt.description,
      });

      const isRecurring = evt.recurrence !== "Once";
      const nextStatus =
        dispatch.status === "Failed"
          ? "Failed"
          : isRecurring
            ? "Scheduled"
            : "Sent";

      const nextRunAt = isRecurring
        ? computeNextRunDate(evt.nextRunAt > now ? evt.nextRunAt : now, evt.recurrence)
        : evt.nextRunAt;

      await db
        .update(events)
        .set({
          status: nextStatus,
          lastSentAt: now,
          nextRunAt,
          updatedAt: now,
        })
        .where(eq(events.id, evt.id));

      results.push({
        eventId: evt.id,
        eventCode: evt.eventCode,
        status: dispatch.status,
        deliveryMode: dispatch.deliveryMode,
      });
    }

    return { processedCount: results.length, logs: results };
  } finally {
    processingDue = false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
