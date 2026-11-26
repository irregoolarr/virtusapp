import { idParam, parseBody, route } from "@/server/http";
import { deleteEvent, updateEvent } from "@/server/services/events";
import { eventCreateSchema } from "@/shared/schemas";

export const PATCH = route("events:write", async ({ req, params }) => {
  const input = await parseBody(req, eventCreateSchema.partial(), "Invalid event update");
  return { item: await updateEvent(idParam(params), input) };
});

export const DELETE = route("events:delete", async ({ params, user }) => {
  await deleteEvent(idParam(params), user.id);
  return { ok: true };
});
