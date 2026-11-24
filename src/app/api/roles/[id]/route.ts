import { idParam, parseBody, route } from "@/server/http";
import { deleteRole, updateRole } from "@/server/services/roles";
import { roleCreateSchema } from "@/shared/schemas";

export const PATCH = route("rbac:manage", async ({ req, params }) => {
  const input = await parseBody(req, roleCreateSchema.partial(), "Invalid role update");
  return { item: await updateRole(idParam(params), input) };
});

export const DELETE = route("rbac:manage", async ({ params }) => {
  await deleteRole(idParam(params));
  return { ok: true };
});
