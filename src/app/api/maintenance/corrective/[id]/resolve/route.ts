import { idParam, parseBody, route } from "@/server/http";
import { resolveCorrective } from "@/server/services/corrective";
import { resolveSchema } from "@/shared/schemas";

export const POST = route("maintenance:write", async ({ req, params, user }) => {
  const input = await parseBody(req, resolveSchema);
  return { item: await resolveCorrective(idParam(params), input, user.id) };
});
