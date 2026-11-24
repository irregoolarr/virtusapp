export async function register() {
  // On Vercel (serverless) the in-process timer can't run reliably;
  // reminders are triggered via /api/cron/events instead.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const g = globalThis as unknown as {
      __virtusSchedulerStarted?: boolean;
      __virtusSchedulerLastBeat?: string;
    };

    if (g.__virtusSchedulerStarted) return;
    g.__virtusSchedulerStarted = true;

    const { processDueEvents } = await import("@/lib/mailer");
    const { runSlaChecks } = await import("@/server/services/corrective");

    const tick = async () => {
      try {
        g.__virtusSchedulerLastBeat = new Date().toISOString();
        await processDueEvents();
        await runSlaChecks();
      } catch {
        // Ignore transient startup DB errors before migrations run
      }
    };

    setTimeout(() => {
      void tick();
    }, 8000);

    setInterval(() => {
      void tick();
    }, 60_000);
  }
}
