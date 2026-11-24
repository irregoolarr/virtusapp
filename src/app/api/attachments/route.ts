import { ENTITY_PERMISSIONS, parseEntityRef } from "@/server/entities";
import { badRequest, created, requirePermission, route } from "@/server/http";
import { attachmentStorageMode, listAttachments, uploadAttachment } from "@/server/services/attachments";

/** Files of one record: ?entityType=corrective&entityId=1 */
export const GET = route(null, async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const { entityType, entityId } = parseEntityRef(sp.get("entityType"), sp.get("entityId"));
  requirePermission(user, ENTITY_PERMISSIONS[entityType].read);
  return { items: await listAttachments(entityType, entityId), storage: attachmentStorageMode() };
});

/** multipart/form-data: entityType, entityId, file */
export const POST = route(null, async ({ req, user }) => {
  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Expected multipart form data");
  const { entityType, entityId } = parseEntityRef(form.get("entityType"), form.get("entityId"));
  requirePermission(user, ENTITY_PERMISSIONS[entityType].write);
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("No file uploaded");
  return created({ item: await uploadAttachment(entityType, entityId, file, user) });
});
