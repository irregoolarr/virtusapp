import { parseBody, route } from "@/server/http";
import { getSettings, sendTestAlert, updateSettings } from "@/server/services/settings";
import { settingsUpdateSchema } from "@/shared/schemas";

export const GET = route("settings:manage", async () => getSettings());

export const PUT = route("settings:manage", async ({ req }) => {
  await updateSettings(await parseBody(req, settingsUpdateSchema, "Invalid settings payload"));
  return { ok: true };
});

/** Send a test alert email through the configured transport. */
export const POST = route("events:dispatch", async ({ req, user }) => {
  const body = (await req.json().catch(() => ({}))) as { recipient?: string };
  return { dispatch: await sendTestAlert(user, body.recipient) };
});
