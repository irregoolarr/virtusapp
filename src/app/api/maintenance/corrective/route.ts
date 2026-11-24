import { created, parseBody, route } from "@/server/http";
import { createCorrective, listCorrective } from "@/server/services/corrective";
import { runScheduledChecksQuietly } from "@/server/services/monitoring";
import { correctiveCreateSchema } from "@/shared/schemas";

export const GET = route("maintenance:read", async () => {
  // Opportunistic SLA / PM checks (at most once a minute per server instance) so alerts
  // happen promptly even where the platform cron only runs daily.
  await runScheduledChecksQuietly();
  return { items: await listCorrective() };
});

export const POST = route("maintenance:write", async ({ req, user }) => {
  const input = await parseBody(req, correctiveCreateSchema, "Invalid corrective maintenance input");
  return created({ item: await createCorrective(input, user.id) });
});
