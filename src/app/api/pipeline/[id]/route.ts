import { idParam, parseBody, route } from "@/server/http";
import { deleteDeal, updateDeal } from "@/server/services/pipeline";
import { pipelineCreateSchema } from "@/shared/schemas";

export const PATCH = route("pipeline:write", async ({ req, params }) => {
  const input = await parseBody(req, pipelineCreateSchema.partial(), "Invalid update payload");
  return { item: await updateDeal(idParam(params), input) };
});

export const DELETE = route("pipeline:delete", async ({ params, user }) => {
  await deleteDeal(idParam(params), user.id);
  return { ok: true };
});
