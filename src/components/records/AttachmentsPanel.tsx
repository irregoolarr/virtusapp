"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Paperclip, Trash2, Upload, X } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { formatDateTime } from "@/lib/utils";
import { ATTACHMENT_MAX_BYTES } from "@/shared/constants";
import type { AttachmentItem } from "@/shared/types";

const formatSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.zip,.msg,.eml,.log,.json,.xml";

/** Upload queued files to a record. Returns the names that failed. */
export async function uploadAttachments(entityType: string, entityId: number, files: File[]): Promise<string[]> {
  const failed: string[] = [];
  for (const file of files) {
    const body = new FormData();
    body.set("entityType", entityType);
    body.set("entityId", String(entityId));
    body.set("file", file);
    const res = await fetch("/api/attachments", { method: "POST", body });
    if (!res.ok) failed.push(file.name);
  }
  return failed;
}

/**
 * New record: files are queued (`pending`) and uploaded after the record is created.
 * Existing record: files upload immediately and are listed with download / delete.
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
  const [storage, setStorage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/attachments?entityType=${entityType}&entityId=${entityId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setStorage(data.storage ?? "");
      }
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
    const tooBig = files.filter((f) => f.size > ATTACHMENT_MAX_BYTES);
    if (tooBig.length) notify(`Too large (max ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB): ${tooBig.map((f) => f.name).join(", ")}`, "error");
    const ok = files.filter((f) => f.size <= ATTACHMENT_MAX_BYTES && f.size > 0);
    if (ok.length === 0) return;

    if (!entityId) {
      onPendingChange?.([...(pending ?? []), ...ok]);
      return;
    }
    setBusy(true);
    try {
      const failed = await uploadAttachments(entityType, entityId, ok);
      if (failed.length) notify(`Upload failed: ${failed.join(", ")}`, "error");
      else notify(ok.length === 1 ? "File attached" : `${ok.length} files attached`);
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
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
          items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#6B7280] shrink-0" />
                <a href={`/api/attachments/${a.id}`} className="truncate text-[#1668AC] hover:underline" title={`Download ${a.fileName}`}>
                  {a.fileName}
                </a>
                <span className="text-[12px] text-[#6B7280] shrink-0 hidden sm:inline">
                  {formatSize(a.sizeBytes)} · {a.uploadedByName ?? "—"} · {formatDateTime(a.createdAt)}
                </span>
              </span>
              <span className="flex items-center shrink-0">
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
          ))}
        {((isNew && !(pending ?? []).length) || (!isNew && !items.length)) && (
          <li className="px-3 py-3 text-[12.5px] text-[#6B7280]">
            {loading ? "Loading…" : `No files yet. Up to ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB each (PDF, Office, images, ZIP…).`}
          </li>
        )}
      </ul>
      {!isNew && storage && (
        <p className="px-3 py-1.5 border-t border-[#E9ECEF] text-[11.5px] text-[#6B7280]">
          Storage: {storage === "Google Drive" ? "Google Drive" : "Database (Google Drive not connected yet)"}
        </p>
      )}
    </section>
  );
}
