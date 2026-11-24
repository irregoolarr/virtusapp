import { and, desc, eq } from "drizzle-orm";
import { attachments, db, users } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { ENTITY_PERMISSIONS, recordCode, type EntityType } from "@/server/entities";
import { ApiError, badRequest, notFound, serialize } from "@/server/http";
import {
  createResumableSession,
  deleteFromDrive,
  downloadFromDrive,
  ensureRecordFolder,
  getDriveFile,
  isDriveConfigured,
  uploadToDrive,
} from "@/server/storage/googleDrive";
import type { AttachmentItem } from "@/shared/types";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_BYTES_DRIVE } from "@/shared/constants";
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
  const fileName = cleanName(file.name);
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

/** What the browser may upload: size limit and whether direct-to-Drive uploads are available. */
export function attachmentConfig() {
  const drive = isDriveConfigured();
  return { storage: attachmentStorageMode(), maxBytes: drive ? ATTACHMENT_MAX_BYTES_DRIVE : ATTACHMENT_MAX_BYTES, proxyMaxBytes: ATTACHMENT_MAX_BYTES, directUpload: drive };
}

const cleanName = (name: string) => name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255) || "attachment";

/** Step 1 of a large upload: create a Google Drive upload session for the browser. */
export async function startDirectUpload(
  entityType: EntityType,
  entityId: number,
  meta: { fileName: string; mimeType: string; size: number },
  origin: string
): Promise<{ uploadUrl: string }> {
  if (!isDriveConfigured()) throw badRequest("Large uploads need Google Drive to be connected");
  if (meta.size <= 0 || meta.size > ATTACHMENT_MAX_BYTES_DRIVE) {
    throw badRequest(`File must be between 1 byte and ${ATTACHMENT_MAX_BYTES_DRIVE / 1024 / 1024} MB`);
  }
  const fileName = cleanName(meta.fileName);
  if (BLOCKED.test(fileName)) throw badRequest("This file type is not allowed");
  const code = await recordCode(entityType, entityId);
  const uploadUrl = await createResumableSession({
    section: ENTITY_PERMISSIONS[entityType].section,
    recordCode: code,
    fileName,
    mimeType: (meta.mimeType || "application/octet-stream").slice(0, 150),
    size: meta.size,
    origin,
  });
  return { uploadUrl };
}

/** Step 2: the browser finished the upload — verify the Drive file and record it. */
export async function completeDirectUpload(entityType: EntityType, entityId: number, driveFileId: string, actor: AuthenticatedUser) {
  const code = await recordCode(entityType, entityId);
  const file = await getDriveFile(driveFileId);
  if (!file) throw badRequest("Uploaded file was not found in Google Drive");
  // Only accept files that landed in this record's own folder.
  const folder = await ensureRecordFolder(ENTITY_PERMISSIONS[entityType].section, code);
  if (!file.parents.includes(folder)) throw badRequest("Uploaded file is not in this record's folder");
  if (BLOCKED.test(file.name) || file.size > ATTACHMENT_MAX_BYTES_DRIVE) {
    await deleteFromDrive(file.id).catch(() => undefined);
    throw badRequest("This file is not allowed");
  }
  const [created] = await db
    .insert(attachments)
    .values({
      entityType,
      entityId,
      fileName: cleanName(file.name),
      mimeType: file.mimeType.slice(0, 150),
      sizeBytes: file.size,
      storage: "drive",
      driveFileId: file.id,
      driveLink: file.webViewLink,
      uploadedById: actor.id,
    })
    .returning(listColumns);
  await logActivity({
    entityType,
    entityId,
    type: "Attachment",
    category: "Attachment Added",
    subject: `${code} - ${created.fileName} attached`,
    body: "Stored in Google Drive (direct upload)",
    actorId: actor.id,
  });
  return serialize({ ...created, uploadedByName: actor.name });
}
