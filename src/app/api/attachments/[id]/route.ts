import { ENTITY_PERMISSIONS, type EntityType } from "@/server/entities";
import { idParam, requirePermission, route } from "@/server/http";
import { deleteAttachment, getAttachmentMeta, readAttachment } from "@/server/services/attachments";
import { PREVIEWABLE_MIME } from "@/shared/constants";

const perms = (entityType: string) => ENTITY_PERMISSIONS[entityType as EntityType];

/**
 * Download through the app so access stays permission-checked (also for Drive files).
 * `?inline=1` shows PDFs / images / plain text in the browser (preview); any other
 * type is always served as a download.
 */
export const GET = route(null, async ({ req, params, user }) => {
  const id = idParam(params);
  const meta = await getAttachmentMeta(id);
  requirePermission(user, perms(meta.entityType)?.read ?? "rbac:manage");
  const file = await readAttachment(id);
  const mime = file.mimeType.toLowerCase();
  const inline = req.nextUrl.searchParams.get("inline") === "1" && (PREVIEWABLE_MIME as readonly string[]).includes(mime);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": inline && mime.startsWith("text/") ? `${mime}; charset=utf-8` : inline ? mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      // Previews may not run scripts or load anything else. (Not set for PDFs: a strict
      // CSP stops Chrome's built-in PDF viewer, and PDFs are shown by that viewer, not as a page.)
      ...(mime !== "application/pdf" && {
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      }),
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
