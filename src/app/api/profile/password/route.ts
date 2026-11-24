import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { parseBody, route } from "@/server/http";
import { changeOwnPassword } from "@/server/services/users";
import { passwordChangeSchema } from "@/shared/schemas";

/** Any signed-in user may change their own password. */
export const POST = route(null, async ({ req, user }) => {
  const input = await parseBody(req, passwordChangeSchema);
  await changeOwnPassword(user.id, input, req.cookies.get(SESSION_COOKIE_NAME)?.value);
  return { ok: true };
});
