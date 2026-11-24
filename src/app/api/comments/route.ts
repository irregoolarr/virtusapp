import { badRequest, created, parseBody, route } from "@/server/http";
import { addComment, listComments } from "@/server/services/comments";
import { commentCreateSchema } from "@/shared/schemas";

export const GET = route(null, async ({ req }) => {
  const entityType = req.nextUrl.searchParams.get("entityType");
  const entityId = Number(req.nextUrl.searchParams.get("entityId"));
  if (!entityType || !Number.isInteger(entityId) || entityId <= 0) {
    throw badRequest("entityType and valid entityId required");
  }
  return { comments: await listComments(entityType, entityId) };
});

export const POST = route(null, async ({ req, user }) => {
  const input = await parseBody(req, commentCreateSchema, "Invalid comment payload");
  return created({ comment: await addComment(input, user) });
});
