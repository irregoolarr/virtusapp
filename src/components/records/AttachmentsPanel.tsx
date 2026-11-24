"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, Paperclip, Trash2, Upload, X } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/ToastProvider";
import { formatDateTime } from "@/lib/utils";
import { ATTACHMENT_MAX_BYTES, PREVIEWABLE_MIME } from "@/shared/constants";
import type { AttachmentItem } from "@/shared/types";

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip,.msg,.eml,.log,.json,.xml";

const isPreviewable = (mime: string) => (PREVIEWABLE_MIME as readonly string[]).includes(mime.toLowerCase());

interface UploadConfig {
  storage: string;
  maxBytes: number;
  proxyMaxBytes: number;
  directUpload: boolean;
}

const FALLBACK_CONFIG: UploadConfig = {
  storage: "Database",
  maxBytes: ATTACHMENT_MAX_BYTES,
  proxyMaxBytes: ATTACHMENT_MAX_BYTES,
  directUpload: false,
};

let configCache: Promise<UploadConfig> | null = null;
function loadConfig(): Promise<UploadConfig> {
  configCache ??= fetch("/api/attachments/config")
    .then((r) => (r.ok ? r.json() : FALLBACK_CONFIG))
    .catch(() => FALLBACK_CONFIG);
  return configCache;
}

/** PUT a file straight to the Google Drive session URL, reporting progress. */
function putToDrive(url: string, file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve((JSON.parse(xhr.responseText) as { id: string }).id);
        } catch {
          reject(new Error("Unexpected response from Google Drive"));
        }
      } else reject(new Error(`Google Drive upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

/** Upload one file: through the app when small, straight to Google Drive when large. */
async function uploadOne(entityType: string, entityId: number, file: File, onProgress: (pct: number) => void): Promise<void> {
  const config = await loadConfig();
  if (file.size > config.proxyMaxBytes) {
    if (!config.directUpload) throw new Error(`larger than ${config.proxyMaxBytes / 1024 / 1024} MB`);
    const start = await fetch("/api/attachments/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, fileName: file.name, mimeType: file.type, size: file.size }),
    });
    if (!start.ok) throw new Error((await start.json().catch(() => ({}))).error || "could not start upload");
    const { uploadUrl } = await start.json();
    const driveFileId = await putToDrive(uploadUrl, file, onProgress);
    const done = await fetch("/api/attachments/direct/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId, driveFileId }),
    });
    if (!done.ok) throw new Error((await done.json().catch(() => ({}))).error || "could not finish upload");
    return;
  }
  const body = new FormData();
  body.set("entityType", entityType);
  body.set("entityId", String(entityId));
  body.set("file", file);
  const res = await fetch("/api/attachments", { method: "POST", body });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `upload failed (${res.status})`);
  onProgress(100);
}

/** Upload queued files to a record. Returns "name: reason" for files that failed. */
export async function uploadAttachments(
  entityType: string,
  entityId: number,
  files: File[],
  onProgress?: (fileName: string, pct: number) => void
): Promise<string[]> {
  const failed: string[] = [];
  for (const file of files) {
    try {
      await uploadOne(entityType, entityId, file, (pct) => onProgress?.(file.name, pct));
    } catch (err) {
      failed.push(`${file.name} (${err instanceof Error ? err.message : "failed"})`);
    }
  }
  return failed;
}

/**
 * New record: files are queued (`pending`) and uploaded after the record is created.
 * Existing record: files upload immediately and can be previewed, downloaded or removed.
 */
export function AttachmentsPanel({
  entityType,
  entityId,
  canEdit,
  pending,
  onPendingChange,
  onChanged,
}: {
  entityType: string;
  entityId: number | null;
  canEdit: boolean;
  pending?: File[];
  onPendingChange?: (files: File[]) => void;
  onChanged?: () => void;
}) {
  const { notify } = useToast();
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [config, setConfig] = useState<UploadConfig>(FALLBACK_CONFIG);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<AttachmentItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = Object.keys(progress).length > 0;

  useEffect(() => {
    void loadConfig().then(setConfig);
  }, []);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/attachments?entityType=${entityType}&entityId=${entityId}`, { cache: "no-store" });
      if (res.ok) setItems((await res.json()).items ?? []);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    setItems([]);
    void load();
  }, [load]);

  const pick = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (inputRef.current) inputRef.current.value = "";
    const limitMb = config.maxBytes / 1024 / 1024;
    const tooBig = files.filter((f) => f.size > config.maxBytes);
    if (tooBig.length) notify(`Too large (max ${limitMb} MB): ${tooBig.map((f) => f.name).join(", ")}`, "error");
    const ok = files.filter((f) => f.size <= config.maxBytes && f.size > 0);
    if (ok.length === 0) return;

    if (!entityId) {
      onPendingChange?.([...(pending ?? []), ...ok]);
      return;
    }
    setProgress(Object.fromEntries(ok.map((f) => [f.name, 0])));
    try {
      const failed = await uploadAttachments(entityType, entityId, ok, (name, pct) => setProgress((p) => ({ ...p, [name]: pct })));
      if (failed.length) notify(`Upload failed: ${failed.join(", ")}`, "error");
      else notify(ok.length === 1 ? "File attached" : `${ok.length} files attached`);
      await load();
      onChanged?.();
    } finally {
      setProgress({});
    }
  };

  const remove = async (a: AttachmentItem) => {
    if (!window.confirm(`Remove ${a.fileName}?`)) return;
    const res = await fetch(`/api/attachments/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Attachment removed");
      await load();
      onChanged?.();
    } else {
      notify((await res.json().catch(() => ({}))).error || "Could not remove attachment", "error");
    }
  };

  const isNew = !entityId;
  const limitText = `Up to ${config.maxBytes / 1024 / 1024} MB each${config.directUpload ? " (large files go straight to Google Drive)" : ""}`;

  return (
    // Uploads on an existing record save immediately, so they don't count as unsaved form edits.
    <section className="border border-[#D9DEE3]" data-ignore-dirty={isNew ? undefined : ""}>
      <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[#D9DEE3] bg-[#F6F7F8]">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#2B3036]">
          <Paperclip className="w-4 h-4 text-[#6B7280]" />
          Attachments ({isNew ? pending?.length ?? 0 : items.length})
        </h3>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => void pick(e.target.files)} />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-7 px-2 text-[12px] font-semibold uppercase tracking-[0.02em] text-[#1668AC] hover:bg-[#EDF2F6] disabled:opacity-40"
            >
              <Upload className={busy ? "w-3.5 h-3.5 animate-pulse" : "w-3.5 h-3.5"} />
              {busy ? "Uploading..." : "Add files"}
            </button>
          </>
        )}
      </header>

      {busy && (
        <ul className="px-3 py-2 space-y-1.5 border-b border-[#E9ECEF]" aria-live="polite">
          {Object.entries(progress).map(([name, pct]) => (
            <li key={name} className="text-[12px] text-[#4B5563]">
              <div className="flex justify-between">
                <span className="truncate">{name}</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="h-1 bg-[#E9ECEF] mt-0.5">
                <div className="h-1 bg-[#1668AC] transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ul className="divide-y divide-[#E9ECEF] text-[13px]">
        {isNew &&
          (pending ?? []).map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#6B7280] shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="text-[12px] text-[#6B7280] shrink-0">{formatSize(f.size)} · uploads on save</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onPendingChange?.((pending ?? []).filter((_, j) => j !== i))}
                className="p-1 text-[#8A94A0] hover:text-[#B42318]"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        {!isNew &&
          items.map((a) => {
            const canPreview = isPreviewable(a.mimeType);
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[#6B7280] shrink-0" />
                  {canPreview ? (
                    <button type="button" onClick={() => setPreview(a)} className="truncate text-left text-[#1668AC] hover:underline" title={`Preview ${a.fileName}`}>
                      {a.fileName}
                    </button>
                  ) : (
                    <a href={`/api/attachments/${a.id}`} className="truncate text-[#1668AC] hover:underline" title={`Download ${a.fileName}`}>
                      {a.fileName}
                    </a>
                  )}
                  <span className="text-[12px] text-[#6B7280] shrink-0 hidden sm:inline">
                    {formatSize(a.sizeBytes)} · {a.uploadedByName ?? "—"} · {formatDateTime(a.createdAt)}
                  </span>
                </span>
                <span className="flex items-center shrink-0">
                  {canPreview && (
                    <button type="button" onClick={() => setPreview(a)} aria-label={`Preview ${a.fileName}`} className="p-1 text-[#1668AC] hover:bg-[#EDF2F6]">
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <a href={`/api/attachments/${a.id}`} aria-label={`Download ${a.fileName}`} className="p-1 text-[#1668AC] hover:bg-[#EDF2F6]">
                    <Download className="w-4 h-4" />
                  </a>
                  {canEdit && (
                    <button type="button" aria-label={`Remove ${a.fileName}`} onClick={() => void remove(a)} className="p-1 text-[#8A94A0] hover:text-[#B42318]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        {((isNew && !(pending ?? []).length) || (!isNew && !items.length)) && (
          <li className="px-3 py-3 text-[12.5px] text-[#6B7280]">{loading ? "Loading…" : `No files yet. ${limitText}.`}</li>
        )}
      </ul>
      {!isNew && (
        <p className="px-3 py-1.5 border-t border-[#E9ECEF] text-[11.5px] text-[#6B7280]">
          Storage: {config.storage === "Google Drive" ? "Google Drive" : "Database (Google Drive not connected yet)"} · {limitText}
        </p>
      )}

      <Dialog open={Boolean(preview)} title={preview?.fileName ?? "Preview"} onClose={() => setPreview(null)} width="max-w-5xl">
        {preview && (
          <div className="space-y-3">
            <div className="h-[70vh] bg-[#F6F7F8] border border-[#E9ECEF] flex items-center justify-center overflow-auto">
              {preview.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/attachments/${preview.id}?inline=1`} alt={preview.fileName} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={`/api/attachments/${preview.id}?inline=1`} title={preview.fileName} className="w-full h-full bg-white" />
              )}
            </div>
            <div className="flex justify-end">
              <a
                href={`/api/attachments/${preview.id}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-semibold uppercase tracking-[0.02em] text-[#1668AC] hover:bg-[#EDF2F6]"
              >
                <Download className="w-4 h-4" /> Download
              </a>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
