export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const g = globalThis as unknown as {
      __virtusSchedulerStarted?: boolean;
      __virtusSchedulerLastBeat?: string;
    };

    if (g.__virtusSchedulerStarted) return;
    g.__virtusSchedulerStarted = true;

    const { processDueEvents } = await import("@/lib/mailer");

    const tick = async () => {
      try {
        g.__virtusSchedulerLastBeat = new Date().toISOString();
        await processDueEvents();
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
