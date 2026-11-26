import { idParam, parseBody, route } from "@/server/http";
import { deletePreventive, updatePreventive } from "@/server/services/preventive";
import { preventiveCreateSchema } from "@/shared/schemas";

export const PATCH = route("maintenance:write", async ({ req, params, user }) => {
  const input = await parseBody(req, preventiveCreateSchema.partial(), "Invalid update payload");
  return { item: await updatePreventive(idParam(params), input, user.id) };
});

export const DELETE = route("maintenance:delete", async ({ params, user }) => {
  await deletePreventive(idParam(params), user.id);
  return { ok: true };
});
