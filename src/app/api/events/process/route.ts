import { route } from "@/server/http";
import { dispatchEventNow, processDueEvents } from "@/server/services/events";
import { runScheduledChecks } from "@/server/services/monitoring";

/** `{ eventId }` sends that event now; an empty body runs every due reminder. */
export const POST = route("events:dispatch", async ({ req }) => {
  const body = (await req.json().catch(() => ({}))) as { eventId?: number };
  if (body.eventId) return { dispatched: await dispatchEventNow(Number(body.eventId)) };
  const result = await processDueEvents();
  return { ...result, ...(await runScheduledChecks()) };
});
