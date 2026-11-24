import { ENTITY_PERMISSIONS, type EntityType } from "@/server/entities";
import { idParam, requirePermission, route } from "@/server/http";
import { deleteAttachment, getAttachmentMeta, readAttachment } from "@/server/services/attachments";

const perms = (entityType: string) => ENTITY_PERMISSIONS[entityType as EntityType];

/** Download through the app so access stays permission-checked (also for Drive files). */
export const GET = route(null, async ({ params, user }) => {
  const id = idParam(params);
  const meta = await getAttachmentMeta(id);
  requirePermission(user, perms(meta.entityType)?.read ?? "rbac:manage");
  const file = await readAttachment(id);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});

export const DELETE = route(null, async ({ params, user }) => {
  const id = idParam(params);
  const meta = await getAttachmentMeta(id);
  requirePermission(user, perms(meta.entityType)?.write ?? "rbac:manage");
  await deleteAttachment(id, user);
  return { ok: true };
});
