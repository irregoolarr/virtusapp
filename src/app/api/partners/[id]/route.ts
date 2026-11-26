import { idParam, parseBody, route } from "@/server/http";
import { deletePartner, updatePartner } from "@/server/services/customers";
import { partnerCreateSchema } from "@/shared/schemas";

export const PATCH = route("customers:write", async ({ req, params }) => {
  const input = await parseBody(req, partnerCreateSchema.partial(), "Invalid partner update");
  return { item: await updatePartner(idParam(params), input) };
});

export const DELETE = route("customers:delete", async ({ params, user }) => {
  await deletePartner(idParam(params), user.id);
  return { ok: true };
});
