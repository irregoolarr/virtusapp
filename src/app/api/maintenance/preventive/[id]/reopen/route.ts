import { idParam, parseBody, route } from "@/server/http";
import { reopenPreventive } from "@/server/services/preventive";
import { reopenSchema } from "@/shared/schemas";

export const POST = route("maintenance:write", async ({ req, params, user }) => {
  const input = await parseBody(req, reopenSchema);
  return { item: await reopenPreventive(idParam(params), input, user.id) };
});
