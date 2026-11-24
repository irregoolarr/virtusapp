// Time-based checks: Corrective SLA escalation/breach and Preventive reminders/overdue.
import { runSlaChecks } from "./corrective";
import { runPmChecks } from "./preventive";

let lastRun = 0;

/**
 * Run all scheduled checks. With `minIntervalMs` it runs at most that often per server
 * instance (used when pages load, so alerts are timely even where cron is daily-only).
 */
export async function runScheduledChecks(opts: { minIntervalMs?: number } = {}) {
  if (opts.minIntervalMs && Date.now() - lastRun < opts.minIntervalMs) return null;
  lastRun = Date.now();
  const [sla, pm] = await Promise.all([runSlaChecks(), runPmChecks()]);
  return { sla, pm };
}

/** Fire-and-forget variant for read endpoints: never fails the request. */
export async function runScheduledChecksQuietly(): Promise<void> {
  await runScheduledChecks({ minIntervalMs: 60_000 }).catch((err) => console.error("Scheduled checks failed", err));
}
