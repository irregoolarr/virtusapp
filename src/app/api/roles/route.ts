import { created, parseBody, route } from "@/server/http";
import { createRole, listRoles } from "@/server/services/roles";
import { roleCreateSchema } from "@/shared/schemas";

export const GET = route("users:read", async () => listRoles());

export const POST = route("rbac:manage", async ({ req }) => {
  const input = await parseBody(req, roleCreateSchema, "Invalid role payload");
  return created({ item: await createRole(input) });
});
