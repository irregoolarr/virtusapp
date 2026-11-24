import { idParam, parseBody, route } from "@/server/http";
import { reopenCorrective } from "@/server/services/corrective";
import { reopenSchema } from "@/shared/schemas";

export const POST = route("maintenance:write", async ({ req, params, user }) => {
  const input = await parseBody(req, reopenSchema);
  return { item: await reopenCorrective(idParam(params), input, user.id) };
});
