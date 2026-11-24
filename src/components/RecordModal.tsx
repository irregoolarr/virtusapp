"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2, X } from "lucide-react";
import { Dialog, TextButton } from "@/components/Dialog";
import { cn, formatDateTime, getInitials } from "@/lib/utils";

interface CommentRow {
  id: number;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorJobTitle: string | null;
  authorAvatarColor: string | null;
}

interface RecordModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  entityType?: "corrective" | "preventive" | "implementation" | "poc" | "pipeline" | "customer";
  entityId?: number | null;
  canDelete?: boolean;
  onDelete?: () => Promise<void> | void;
  /** "wide" for records with grids inside (e.g. Activity History). */
  size?: "default" | "wide";
  /** Show the simple notes thread (modules without an Activity History). */
  showComments?: boolean;
  children: React.ReactNode;
}

export function RecordModal({
  open,
  title,
  subtitle,
  onClose,
  entityType,
  entityId,
  canDelete,
  onDelete,
  size = "default",
  showComments = true,
  children,
}: RecordModalProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // A fresh record (or reopening) starts clean.
  useEffect(() => {
    setDirty(false);
    setConfirmOpen(false);
  }, [open, entityId, title]);

  /** Close, but ask first when the form has unsaved edits. */
  const requestClose = useCallback(() => {
    if (dirty) setConfirmOpen(true);
    else onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // Any edit inside the drawer (except areas marked data-ignore-dirty) marks it dirty.
  const markDirty = (e: React.FormEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-ignore-dirty]")) setDirty(true);
  };

  const saveFromPrompt = () => {
    setConfirmOpen(false);
    const form = bodyRef.current?.querySelector<HTMLFormElement>("form[data-record-form]") ?? bodyRef.current?.querySelector("form");
    form?.requestSubmit();
  };
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (!open || !entityType || !entityId) {
      setComments([]);
      return;
    }
    fetch(`/api/comments?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => setComments(d.comments ?? []))
      .catch(() => setComments([]));
  }, [open, entityType, entityId]);

  if (!open) return null;

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !entityType || !entityId) return;
    setSendingComment(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          body: commentText.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [data.comment, ...prev]);
        setCommentText("");
      }
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/35 backdrop-blur-[1px]">
      <div className="fixed inset-0" onClick={requestClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "drawer-in relative z-10 w-full h-full bg-white border-l border-[#D9DEE3] shadow-2xl flex flex-col",
          size === "wide" ? "max-w-4xl" : "max-w-xl"
        )}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-[#EEF1F4] border-b border-[#D9DEE3] flex items-start justify-between gap-4">
          <div className="min-w-0">
            {subtitle && (
              <div className="font-mono text-[11px] text-[#6B7280] mb-1">{subtitle}</div>
            )}
            <h2 className="text-[18px] font-semibold text-[#2B3036] truncate">{title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => void onDelete()}
                title="Delete record"
                className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={requestClose}
              title="Close (Esc)"
              aria-label="Close"
              className="p-2 rounded-lg text-[#4B5563] hover:bg-black/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} onInput={markDirty} onChange={markDirty} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {children}

          {/* Comments Thread (when editing existing record) */}
          {showComments && entityType && entityId && (
            <div data-ignore-dirty className="pt-5 border-t border-[#D9DEE3]">
              <h3 className="text-[13px] font-semibold text-[#2B3036] mb-3">
                Activity & Notes ({comments.length})
              </h3>
              <form onSubmit={submitComment} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add an engineering note or customer update..."
                  className="flex-1 rounded-sm border border-[#C9D0D7] px-3 py-2 text-[13px] focus:outline-none focus:border-[#1668AC]"
                />
                <button
                  type="submit"
                  disabled={sendingComment || !commentText.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm bg-[#1668AC] text-white text-[12.5px] font-medium disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  Post
                </button>
              </form>
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-[12px] text-[#6B7280]">No notes logged yet.</p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-sm border border-[#D9DEE3] bg-[#F6F7F8] p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full text-[9px] font-medium text-white flex items-center justify-center"
                            style={{ backgroundColor: c.authorAvatarColor || "#18181A" }}
                          >
                            {getInitials(c.authorName || "User")}
                          </span>
                          <span className="text-[12px] font-medium text-[#2B3036]">
                            {c.authorName || "Team Member"}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#6B7280]">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-[#374151] leading-relaxed">{c.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={confirmOpen}
        title="Unsaved changes"
        onClose={() => setConfirmOpen(false)}
        width="max-w-md"
        footer={
          <>
            <TextButton onClick={() => setConfirmOpen(false)} autoFocus>
              Keep editing
            </TextButton>
            <TextButton
              tone="danger"
              onClick={() => {
                setConfirmOpen(false);
                setDirty(false);
                onClose();
              }}
            >
              Discard
            </TextButton>
            <TextButton tone="primary" onClick={saveFromPrompt}>
              Save
            </TextButton>
          </>
        }
      >
        <p className="text-[13px] text-[#4B5563]">You have changes that are not saved yet. Save them before closing?</p>
      </Dialog>
    </div>
  );
}
