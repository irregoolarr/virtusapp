import { idParam, parseBody, route } from "@/server/http";
import { goLiveImplementation } from "@/server/services/implementations";
import { goLiveSchema } from "@/shared/schemas";

/** Finish a project: handover notes required; optionally email the customer. */
export const POST = route("delivery:write", async ({ req, params, user }) => {
  const input = await parseBody(req, goLiveSchema);
  return { item: await goLiveImplementation(idParam(params), input, user.id) };
});
