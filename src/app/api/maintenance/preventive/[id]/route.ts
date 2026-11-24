import { idParam, parseBody, route } from "@/server/http";
import { deletePreventive, updatePreventive } from "@/server/services/preventive";
import { preventiveCreateSchema } from "@/shared/schemas";

export const PATCH = route("maintenance:write", async ({ req, params }) => {
  const input = await parseBody(req, preventiveCreateSchema.partial(), "Invalid update payload");
  return { item: await updatePreventive(idParam(params), input) };
});

export const DELETE = route("maintenance:delete", async ({ params }) => {
  await deletePreventive(idParam(params));
  return { ok: true };
});
