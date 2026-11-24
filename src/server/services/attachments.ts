import { and, desc, eq } from "drizzle-orm";
import { attachments, db, users } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { ENTITY_PERMISSIONS, recordCode, type EntityType } from "@/server/entities";
import { ApiError, badRequest, notFound, serialize } from "@/server/http";
import { deleteFromDrive, downloadFromDrive, isDriveConfigured, uploadToDrive } from "@/server/storage/googleDrive";
import type { AttachmentItem } from "@/shared/types";
import { ATTACHMENT_MAX_BYTES } from "@/shared/constants";
import { logActivity } from "./activities";

// Executable / scriptable types are refused; everything is served as a download.
const BLOCKED = /\.(html?|svg|js|mjs|exe|bat|cmd|sh|ps1|msi|dll|scr|jar)$/i;

const listColumns = {
  id: attachments.id,
  entityType: attachments.entityType,
  entityId: attachments.entityId,
  fileName: attachments.fileName,
  mimeType: attachments.mimeType,
  sizeBytes: attachments.sizeBytes,
  storage: attachments.storage,
  driveLink: attachments.driveLink,
  createdAt: attachments.createdAt,
  uploadedById: attachments.uploadedById,
};

export async function listAttachments(entityType: EntityType, entityId: number): Promise<AttachmentItem[]> {
  const rows = await db
    .select({ ...listColumns, uploadedByName: users.name })
    .from(attachments)
    .leftJoin(users, eq(attachments.uploadedById, users.id))
    .where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)))
    .orderBy(desc(attachments.createdAt));
  return rows.map(serialize);
}

export async function uploadAttachment(entityType: EntityType, entityId: number, file: File, actor: AuthenticatedUser) {
  if (file.size === 0) throw badRequest("File is empty");
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw badRequest(`File is larger than ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB`);
  }
  const fileName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255) || "attachment";
  if (BLOCKED.test(fileName)) throw badRequest("This file type is not allowed");

  const code = await recordCode(entityType, entityId);
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = (file.type || "application/octet-stream").slice(0, 150);

  let stored: { storage: "drive" | "database"; driveFileId?: string; driveLink?: string | null; content?: Buffer };
  if (isDriveConfigured()) {
    try {
      const drive = await uploadToDrive({ section: ENTITY_PERMISSIONS[entityType].section, recordCode: code, fileName, mimeType, bytes });
      stored = { storage: "drive", driveFileId: drive.id, driveLink: drive.webViewLink };
    } catch (err) {
      console.error("Drive upload failed", err);
      throw new ApiError(502, "Could not upload to Google Drive. Check the Drive connection in Settings.");
    }
  } else {
    stored = { storage: "database", content: bytes };
  }

  const [created] = await db
    .insert(attachments)
    .values({ entityType, entityId, fileName, mimeType, sizeBytes: file.size, uploadedById: actor.id, ...stored })
    .returning(listColumns);

  await logActivity({
    entityType,
    entityId,
    type: "Attachment",
    category: "Attachment Added",
    subject: `${code} - ${fileName} attached`,
    body: stored.storage === "drive" ? "Stored in Google Drive" : "Stored in database",
    actorId: actor.id,
  });
  return serialize({ ...created, uploadedByName: actor.name });
}

export async function getAttachmentMeta(id: number) {
  const [row] = await db.select(listColumns).from(attachments).where(eq(attachments.id, id)).limit(1);
  if (!row) throw notFound("Attachment not found");
  return row;
}

export async function readAttachment(id: number): Promise<{ fileName: string; mimeType: string; bytes: Buffer }> {
  const [row] = await db
    .select({ ...listColumns, driveFileId: attachments.driveFileId, content: attachments.content })
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);
  if (!row) throw notFound("Attachment not found");
  const bytes = row.storage === "drive" && row.driveFileId ? await downloadFromDrive(row.driveFileId) : row.content;
  if (!bytes) throw notFound("File content is no longer available");
  return { fileName: row.fileName, mimeType: row.mimeType, bytes: Buffer.from(bytes) };
}

export async function deleteAttachment(id: number, actor: AuthenticatedUser): Promise<void> {
  const [row] = await db
    .select({ ...listColumns, driveFileId: attachments.driveFileId })
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);
  if (!row) throw notFound("Attachment not found");
  if (row.storage === "drive" && row.driveFileId) {
    await deleteFromDrive(row.driveFileId).catch((err) => console.error("Drive delete failed", err));
  }
  await db.delete(attachments).where(eq(attachments.id, id));
  const entityType = row.entityType as EntityType;
  await logActivity({
    entityType,
    entityId: row.entityId,
    type: "Attachment",
    category: "Attachment Removed",
    subject: `${await recordCode(entityType, row.entityId).catch(() => "Record")} - ${row.fileName} removed`,
    actorId: actor.id,
  });
}

/** Delete a file without logging (used when the parent record itself is deleted). */
export async function deleteAttachmentRow(id: number): Promise<void> {
  const [row] = await db
    .select({ storage: attachments.storage, driveFileId: attachments.driveFileId })
    .from(attachments)
    .where(eq(attachments.id, id))
    .limit(1);
  if (row?.storage === "drive" && row.driveFileId) {
    await deleteFromDrive(row.driveFileId).catch((err) => console.error("Drive delete failed", err));
  }
  await db.delete(attachments).where(eq(attachments.id, id));
}

export const attachmentStorageMode = () => (isDriveConfigured() ? "Google Drive" : "Database");
