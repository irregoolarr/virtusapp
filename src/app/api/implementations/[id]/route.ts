import { idParam, parseBody, route } from "@/server/http";
import { deleteImplementation, updateImplementation } from "@/server/services/implementations";
import { implementationCreateSchema } from "@/shared/schemas";

export const PATCH = route("delivery:write", async ({ req, params }) => {
  const input = await parseBody(req, implementationCreateSchema.partial(), "Invalid update payload");
  return { item: await updateImplementation(idParam(params), input) };
});

export const DELETE = route("delivery:delete", async ({ params }) => {
  await deleteImplementation(idParam(params));
  return { ok: true };
});
