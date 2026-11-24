import { z } from "zod";
import { ENTITY_PERMISSIONS, parseEntityRef } from "@/server/entities";
import { created, parseBody, requirePermission, route } from "@/server/http";
import { completeDirectUpload } from "@/server/services/attachments";

const schema = z.object({ entityType: z.string(), entityId: z.number(), driveFileId: z.string().min(5).max(128) });

/** Finish a direct upload: verify the Drive file and add it to the record. */
export const POST = route(null, async ({ req, user }) => {
  const input = await parseBody(req, schema);
  const { entityType, entityId } = parseEntityRef(input.entityType, input.entityId);
  requirePermission(user, ENTITY_PERMISSIONS[entityType].write);
  return created({ item: await completeDirectUpload(entityType, entityId, input.driveFileId, user) });
});
