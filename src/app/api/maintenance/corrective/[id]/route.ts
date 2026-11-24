import { idParam, parseBody, route } from "@/server/http";
import { deleteCorrective, updateCorrective } from "@/server/services/corrective";
import { correctiveCreateSchema } from "@/shared/schemas";

export const PATCH = route("maintenance:write", async ({ req, params }) => {
  const input = await parseBody(req, correctiveCreateSchema.partial(), "Invalid update payload");
  return { item: await updateCorrective(idParam(params), input) };
});

export const DELETE = route("maintenance:delete", async ({ params }) => {
  await deleteCorrective(idParam(params));
  return { ok: true };
});
