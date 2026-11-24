import { created, parseBody, route } from "@/server/http";
import { createCorrective, listCorrective, runSlaChecks } from "@/server/services/corrective";
import { correctiveCreateSchema } from "@/shared/schemas";

export const GET = route("maintenance:read", async () => {
  // Opportunistic SLA check (at most once a minute per server instance) so escalations
  // happen promptly even where the platform cron only runs daily.
  await runSlaChecks({ minIntervalMs: 60_000 }).catch((err) => console.error("SLA check failed", err));
  return { items: await listCorrective() };
});

export const POST = route("maintenance:write", async ({ req, user }) => {
  const input = await parseBody(req, correctiveCreateSchema, "Invalid corrective maintenance input");
  return created({ item: await createCorrective(input, user.id) });
});
