import { idParam, parseBody, route } from "@/server/http";
import { deletePoc, updatePoc } from "@/server/services/poc";
import { pocCreateSchema } from "@/shared/schemas";

export const PATCH = route("delivery:write", async ({ req, params }) => {
  const input = await parseBody(req, pocCreateSchema.partial(), "Invalid update payload");
  return { item: await updatePoc(idParam(params), input) };
});

export const DELETE = route("delivery:delete", async ({ params }) => {
  await deletePoc(idParam(params));
  return { ok: true };
});
