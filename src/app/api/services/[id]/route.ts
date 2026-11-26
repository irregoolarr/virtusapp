import { idParam, parseBody, route } from "@/server/http";
import { deleteServiceNumber, updateServiceNumber } from "@/server/services/serviceNumbers";
import { serviceCreateSchema } from "@/shared/schemas";

export const PATCH = route("services:write", async ({ req, params }) => {
  const input = await parseBody(req, serviceCreateSchema.partial(), "Invalid service update");
  return { item: await updateServiceNumber(idParam(params), input) };
});

export const DELETE = route("services:delete", async ({ params, user }) => {
  await deleteServiceNumber(idParam(params), user.id);
  return { ok: true };
});
