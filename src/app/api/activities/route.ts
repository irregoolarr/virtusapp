import { z } from "zod";
import { ENTITY_PERMISSIONS, parseEntityRef } from "@/server/entities";
import { created, parseBody, requirePermission, route } from "@/server/http";
import { addNote, listActivities } from "@/server/services/activities";

/** Activity History of one record: ?entityType=corrective&entityId=1 */
export const GET = route(null, async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const { entityType, entityId } = parseEntityRef(sp.get("entityType"), sp.get("entityId"));
  requirePermission(user, ENTITY_PERMISSIONS[entityType].read);
  return { items: await listActivities(entityType, entityId) };
});

const noteSchema = z.object({
  entityType: z.string(),
  entityId: z.number(),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  body: z.string().max(5000).default(""),
});

export const POST = route(null, async ({ req, user }) => {
  const input = await parseBody(req, noteSchema);
  const { entityType, entityId } = parseEntityRef(input.entityType, input.entityId);
  requirePermission(user, ENTITY_PERMISSIONS[entityType].write);
  await addNote(entityType, entityId, input.subject, input.body, user);
  return created({ ok: true });
});
