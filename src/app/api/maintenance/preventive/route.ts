import { created, parseBody, route } from "@/server/http";
import { runScheduledChecksQuietly } from "@/server/services/monitoring";
import { createPreventive, listPreventive } from "@/server/services/preventive";
import { preventiveCreateSchema } from "@/shared/schemas";

export const GET = route("maintenance:read", async () => {
  await runScheduledChecksQuietly();
  return { items: await listPreventive() };
});

export const POST = route("maintenance:write", async ({ req, user }) => {
  const input = await parseBody(req, preventiveCreateSchema, "Invalid preventive maintenance input");
  return created({ item: await createPreventive(input, user.id) });
});
