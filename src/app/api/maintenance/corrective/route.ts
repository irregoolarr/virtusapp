import { created, parseBody, route } from "@/server/http";
import { createCorrective, listCorrective } from "@/server/services/corrective";
import { correctiveCreateSchema } from "@/shared/schemas";

export const GET = route("maintenance:read", async () => ({ items: await listCorrective() }));

export const POST = route("maintenance:write", async ({ req, user }) => {
  const input = await parseBody(req, correctiveCreateSchema, "Invalid corrective maintenance input");
  return created({ item: await createCorrective(input, user.id) });
});
