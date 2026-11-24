// Minimal Google Drive v3 client (REST, no SDK) using an OAuth refresh token.
//
// Env (all four required to enable Drive; otherwise files are kept in the DB):
//   GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN
//   GOOGLE_DRIVE_FOLDER_ID (optional) — root folder; if unset the app creates
//   "VirtusMS Attachments" in the connected account's My Drive.
// Scope used when creating the refresh token: https://www.googleapis.com/auth/drive.file
// (the app can only see files and folders it created).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await accessToken()}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Google Drive request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return res;
}

const escapeQuery = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Find a folder by name under `parentId` (or My Drive root), creating it if missing. */
async function ensureFolder(name: string, parentId?: string): Promise<string> {
  const q = [
    `name = '${escapeQuery(name)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
    parentId ? `'${escapeQuery(parentId)}' in parents` : "'root' in parents",
  ].join(" and ");
  const found = await driveFetch(
    `${API}/files?${new URLSearchParams({ q, fields: "files(id)", supportsAllDrives: "true", includeItemsFromAllDrives: "true" })}`
  );
  const { files } = (await found.json()) as { files: Array<{ id: string }> };
  if (files[0]) return files[0].id;

  const created = await driveFetch(`${API}/files?supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId && { parents: [parentId] }) }),
  });
  return ((await created.json()) as { id: string }).id;
}

/** Upload into <root>/<section>/<recordCode>/ and return the Drive file id + link. */
export async function uploadToDrive(params: {
  section: string;
  recordCode: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<{ id: string; webViewLink: string | null }> {
  const root = process.env.GOOGLE_DRIVE_FOLDER_ID || (await ensureFolder("VirtusMS Attachments"));
  const section = await ensureFolder(params.section, root);
  const folder = await ensureFolder(params.recordCode, section);

  const boundary = `virtus-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: params.fileName, parents: [folder] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`),
    params.bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await driveFetch(`${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = (await res.json()) as { id: string; webViewLink?: string };
  return { id: data.id, webViewLink: data.webViewLink ?? null };
}

export async function downloadFromDrive(fileId: string): Promise<Buffer | null> {
  const res = await driveFetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
  if (res.status === 404) return null;
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  await driveFetch(`${API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: "DELETE" });
}
