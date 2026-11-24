import { z } from "zod";
import { ENTITY_PERMISSIONS, parseEntityRef } from "@/server/entities";
import { parseBody, requirePermission, route } from "@/server/http";
import { startDirectUpload } from "@/server/services/attachments";

const schema = z.object({
  entityType: z.string(),
  entityId: z.number(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(150).default("application/octet-stream"),
  size: z.number().int().positive(),
});

/** Start a browser → Google Drive upload for files larger than the app's request limit. */
export const POST = route(null, async ({ req, user }) => {
  const input = await parseBody(req, schema);
  const { entityType, entityId } = parseEntityRef(input.entityType, input.entityId);
  requirePermission(user, ENTITY_PERMISSIONS[entityType].write);
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  return startDirectUpload(entityType, entityId, input, origin);
});
