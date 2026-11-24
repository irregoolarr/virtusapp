import { eq } from "drizzle-orm";
import { appSettings, db } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { getSmtpConfig, sendAlertEmail } from "@/lib/mailer";
import { settingsUpdateSchema } from "@/shared/schemas";
import type { z } from "zod";

const MASK = "••••••••";

const DEFAULT_OPS = {
  companyName: "VirtusMS Managed Services",
  defaultSlaWarningDays: 30,
  autoEscalateCriticalMinutes: 30,
  currencySymbol: "Rp",
};

/** Operational preferences (Settings page) merged over defaults. */
export async function getOpsPreferences(): Promise<typeof DEFAULT_OPS> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "ops_preferences")).limit(1);
  return { ...DEFAULT_OPS, ...((row?.value ?? {}) as Partial<typeof DEFAULT_OPS>) };
}

async function upsertSetting(key: string, value: Record<string, unknown>) {
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

/** Settings for the admin UI; the SMTP password is never sent back, only masked. */
export async function getSettings() {
  const [smtp, opsRow] = await Promise.all([
    getSmtpConfig(),
    db.select().from(appSettings).where(eq(appSettings.key, "ops_preferences")).limit(1),
  ]);
  return {
    smtp: { ...smtp, pass: smtp.pass ? MASK : "", hasPassword: Boolean(smtp.pass) },
    ops: opsRow[0]?.value ?? DEFAULT_OPS,
  };
}

export async function updateSettings(d: z.output<typeof settingsUpdateSchema>): Promise<void> {
  if (d.smtp) {
    // Keep the stored password unless a new one (not the mask) was entered.
    const current = await getSmtpConfig();
    const pass = d.smtp.pass && d.smtp.pass !== MASK ? d.smtp.pass : current.pass;
    await upsertSetting("smtp_config", { ...d.smtp, pass });
  }
  if (d.ops) await upsertSetting("ops_preferences", d.ops);
}

export async function sendTestAlert(actor: AuthenticatedUser, recipient?: string) {
  return sendAlertEmail({
    recipients: [recipient?.trim() || actor.email],
    subject: "[VirtusMS Test Alert] SMTP & Reminder Pipeline Verification",
    body: `This is a live test alert triggered by ${actor.name} (${actor.email}) from VirtusMS Settings.`,
  });
}
