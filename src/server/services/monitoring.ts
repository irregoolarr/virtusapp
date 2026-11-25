// Time-based checks: Corrective SLA, Preventive visits, Implementation go-live and POC review dates.
import { runSlaChecks } from "./corrective";
import { runImplChecks } from "./implementations";
import { runPocChecks } from "./poc";
import { runPmChecks } from "./preventive";

let lastRun = 0;

/**
 * Run all scheduled checks. With `minIntervalMs` it runs at most that often per server
 * instance (used when pages load, so alerts are timely even where cron is daily-only).
 */
export async function runScheduledChecks(opts: { minIntervalMs?: number } = {}) {
  if (opts.minIntervalMs && Date.now() - lastRun < opts.minIntervalMs) return null;
  lastRun = Date.now();
  const [sla, pm, implementation, poc] = await Promise.all([runSlaChecks(), runPmChecks(), runImplChecks(), runPocChecks()]);
  return { sla, pm, implementation, poc };
}

/** Fire-and-forget variant for read endpoints: never fails the request. */
export async function runScheduledChecksQuietly(): Promise<void> {
  await runScheduledChecks({ minIntervalMs: 60_000 }).catch((err) => console.error("Scheduled checks failed", err));
}
