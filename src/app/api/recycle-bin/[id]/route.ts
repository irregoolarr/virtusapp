import { idParam, route } from "@/server/http";
import { purgeFromRecycleBin } from "@/server/services/recycleBin";

/** Delete permanently (needs the module's delete permission). */
export const DELETE = route(null, async ({ params, user }) => {
  await purgeFromRecycleBin(user, idParam(params));
  return { ok: true };
});
