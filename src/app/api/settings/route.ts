import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { appSettings, db } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { getSmtpConfig, sendAlertEmail } from "@/lib/mailer";

export async function GET() {
  const auth = await requireApiAuth("settings:manage");
  if ("error" in auth) return auth.error;

  const [smtp, opsRow] = await Promise.all([
    getSmtpConfig(),
    db.select().from(appSettings).where(eq(appSettings.key, "ops_preferences")).limit(1),
  ]);

  return NextResponse.json({
    smtp: {
      ...smtp,
      pass: smtp.pass ? "••••••••" : "",
      hasPassword: Boolean(smtp.pass),
    },
    ops: opsRow[0]?.value ?? {
      companyName: "VirtusMS Managed Services",
      defaultSlaWarningDays: 30,
      autoEscalateCriticalMinutes: 30,
      currencySymbol: "$",
    },
  });
}

const updateSettingsSchema = z.object({
  smtp: z
    .object({
      host: z.string(),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      user: z.string(),
      pass: z.string().optional(),
      from: z.string(),
      defaultAlertEmail: z.string().email(),
    })
    .optional(),
  ops: z
    .object({
      companyName: z.string().min(2),
      defaultSlaWarningDays: z.number().int().min(1).max(365),
      autoEscalateCriticalMinutes: z.number().int().min(5).max(1440),
      currencySymbol: z.string().min(1).max(4),
    })
    .optional(),
});

export async function PUT(req: NextRequest) {
  const auth = await requireApiAuth("settings:manage");
  if ("error" in auth) return auth.error;

  const parsed = updateSettingsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }

  if (parsed.data.smtp) {
    const current = await getSmtpConfig();
    const nextPass =
      parsed.data.smtp.pass && parsed.data.smtp.pass !== "••••••••"
        ? parsed.data.smtp.pass
        : current.pass;

    const value = { ...parsed.data.smtp, pass: nextPass };
    await db
      .insert(appSettings)
      .values({ key: "smtp_config", value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  if (parsed.data.ops) {
    await db
      .insert(appSettings)
      .values({ key: "ops_preferences", value: parsed.data.ops, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: parsed.data.ops, updatedAt: new Date() },
      });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("events:dispatch");
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as { recipient?: string };
  const recipient = body.recipient?.trim() || auth.user.email;

  const dispatch = await sendAlertEmail({
    recipients: [recipient],
    subject: "[VirtusMS Test Alert] SMTP & Reminder Pipeline Verification",
    body: `This is a live test alert triggered by ${auth.user.name} (${auth.user.email}) from VirtusMS Settings.`,
  });

  return NextResponse.json({ dispatch });
}
