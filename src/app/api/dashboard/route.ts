import { route } from "@/server/http";
import { getDashboard } from "@/server/services/dashboard";
import { runSlaChecks } from "@/server/services/corrective";

export const GET = route("dashboard:read", async () => {
  await runSlaChecks({ minIntervalMs: 60_000 }).catch((err) => console.error("SLA check failed", err));
  return getDashboard();
});
