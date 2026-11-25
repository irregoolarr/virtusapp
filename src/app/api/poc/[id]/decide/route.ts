import { idParam, parseBody, route } from "@/server/http";
import { decidePoc } from "@/server/services/poc";
import { pocDecideSchema } from "@/shared/schemas";

/** Record the POC decision: Success (approve, optional pipeline deal), Extended or Dropped. */
export const POST = route("delivery:write", async ({ req, params, user }) => {
  const input = await parseBody(req, pocDecideSchema);
  return decidePoc(idParam(params), input, user.id);
});
