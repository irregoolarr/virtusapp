import { idParam, parseBody, route } from "@/server/http";
import { closeCorrective } from "@/server/services/corrective";
import { closeSchema } from "@/shared/schemas";

export const POST = route("maintenance:write", async ({ req, params, user }) => {
  const input = await parseBody(req, closeSchema);
  return { item: await closeCorrective(idParam(params), input, user.id) };
});
