import { parseBody, route } from "@/server/http";
import { updateOwnName } from "@/server/services/users";
import { profileNameSchema } from "@/shared/schemas";

/** Any signed-in user may edit their own first / last name. */
export const PATCH = route(null, async ({ req, user }) => {
  const input = await parseBody(req, profileNameSchema);
  return { ok: true, name: await updateOwnName(user.id, input) };
});
