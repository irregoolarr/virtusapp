import { created, parseBody, route } from "@/server/http";
import { createEvent, listEventsWithLogs } from "@/server/services/events";
import { eventCreateSchema } from "@/shared/schemas";

export const GET = route("events:read", async () => listEventsWithLogs());

export const POST = route("events:write", async ({ req, user }) => {
  const input = await parseBody(req, eventCreateSchema, "Invalid event schedule payload");
  return created({ item: await createEvent(input, user.id) });
});
