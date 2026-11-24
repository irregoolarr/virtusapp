import { created, parseBody, route } from "@/server/http";
import { createUser, listTeam } from "@/server/services/users";
import { userCreateSchema } from "@/shared/schemas";

export const GET = route("users:read", async () => ({ items: await listTeam() }));

export const POST = route("users:manage", async ({ req }) => {
  const input = await parseBody(req, userCreateSchema, "Invalid user payload");
  return created({ item: await createUser(input) });
});
