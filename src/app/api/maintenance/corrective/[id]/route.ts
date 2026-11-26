import { idParam, parseBody, route } from "@/server/http";
import { deleteCorrective, updateCorrective } from "@/server/services/corrective";
import { correctiveCreateSchema } from "@/shared/schemas";

export const PATCH = route("maintenance:write", async ({ req, params, user }) => {
  const input = await parseBody(req, correctiveCreateSchema.partial(), "Invalid update payload");
  return { item: await updateCorrective(idParam(params), input, user.id) };
});

export const DELETE = route("maintenance:delete", async ({ params, user }) => {
  await deleteCorrective(idParam(params), user.id);
  return { ok: true };
});
