import { idParam, parseBody, route } from "@/server/http";
import { deleteCustomer, updateCustomer } from "@/server/services/customers";
import { customerCreateSchema } from "@/shared/schemas";

export const PATCH = route("customers:write", async ({ req, params }) => {
  const input = await parseBody(req, customerCreateSchema.partial(), "Invalid customer update");
  return { item: await updateCustomer(idParam(params), input) };
});

export const DELETE = route("customers:delete", async ({ params, user }) => {
  await deleteCustomer(idParam(params), user.id);
  return { ok: true };
});
