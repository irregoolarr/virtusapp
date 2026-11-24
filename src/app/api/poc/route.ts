import { created, parseBody, route } from "@/server/http";
import { createPoc, listPocs } from "@/server/services/poc";
import { pocCreateSchema } from "@/shared/schemas";

export const GET = route("delivery:read", async () => ({ items: await listPocs() }));

export const POST = route("delivery:write", async ({ req, user }) => {
  const input = await parseBody(req, pocCreateSchema, "Invalid POC payload");
  return created({ item: await createPoc(input, user.id) });
});
