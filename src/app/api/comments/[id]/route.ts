import { idParam, parseBody, route } from "@/server/http";
import { deleteComment, updateComment } from "@/server/services/comments";
import { commentUpdateSchema } from "@/shared/schemas";

/** Edit your own comment. */
export const PATCH = route(null, async ({ req, params, user }) => {
  const input = await parseBody(req, commentUpdateSchema);
  return { comment: await updateComment(idParam(params), input, user) };
});

/** Delete your own comment. */
export const DELETE = route(null, async ({ params, user }) => {
  await deleteComment(idParam(params), user);
  return { ok: true };
});
