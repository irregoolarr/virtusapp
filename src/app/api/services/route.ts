import { created, parseBody, route } from "@/server/http";
import { createServiceNumber, listServiceNumbers } from "@/server/services/serviceNumbers";
import { serviceCreateSchema } from "@/shared/schemas";

export const GET = route("services:read", async () => ({ items: await listServiceNumbers() }));

export const POST = route("services:write", async ({ req, user }) => {
  const input = await parseBody(req, serviceCreateSchema, "Invalid service number input");
  return created({ item: await createServiceNumber(input, user.id) });
});
