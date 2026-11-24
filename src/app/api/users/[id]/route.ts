import { idParam, parseBody, route } from "@/server/http";
import { deleteUser, updateUser } from "@/server/services/users";
import { userUpdateSchema } from "@/shared/schemas";

export const PATCH = route("users:manage", async ({ req, params }) => {
  const input = await parseBody(req, userUpdateSchema, "Invalid user update");
  return { item: await updateUser(idParam(params), input) };
});

export const DELETE = route("users:manage", async ({ params, user }) => {
  await deleteUser(idParam(params), user.id);
  return { ok: true };
});
