import { route } from "@/server/http";
import { getDashboard } from "@/server/services/dashboard";
import { runScheduledChecksQuietly } from "@/server/services/monitoring";

export const GET = route("dashboard:read", async () => {
  await runScheduledChecksQuietly();
  return getDashboard();
});
