import { idParam, parseBody, route } from "@/server/http";
import { completePreventive } from "@/server/services/preventive";
import { pmCompleteSchema } from "@/shared/schemas";

/** Complete a visit with its report; optionally schedule the next one and email the customer. */
export const POST = route("maintenance:write", async ({ req, params, user }) => {
  const input = await parseBody(req, pmCompleteSchema);
  return completePreventive(idParam(params), input, user.id);
});
