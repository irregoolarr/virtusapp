"use client";

import React, { useEffect, useState } from "react";
import { Send, Trash2, X } from "lucide-react";
import { formatDateTime, getInitials } from "@/lib/utils";

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
  children,
}: RecordModalProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
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
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-xl h-full bg-white border-l border-[#E8E8E2] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-[#F3F3EB] border-b border-[#E8E8DF] flex items-start justify-between gap-4">
          <div className="min-w-0">
            {subtitle && (
              <div className="font-mono text-[11px] text-[#78787E] mb-1">{subtitle}</div>
            )}
            <h2 className="text-[18px] font-semibold text-[#18181A] truncate">{title}</h2>
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
              onClick={onClose}
              className="p-2 rounded-lg text-[#54545A] hover:bg-black/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {children}

          {/* Comments Thread (when editing existing record) */}
          {entityType && entityId && (
            <div className="pt-5 border-t border-[#ECECE7]">
              <h3 className="text-[13px] font-semibold text-[#18181A] mb-3">
                Activity & Notes ({comments.length})
              </h3>
              <form onSubmit={submitComment} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add an engineering note or customer update..."
                  className="flex-1 rounded-[10px] border border-[#E2E2DA] px-3 py-2 text-[13px] focus:outline-none focus:border-[#18181A]"
                />
                <button
                  type="submit"
                  disabled={sendingComment || !commentText.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-[#18181A] text-white text-[12.5px] font-medium disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  Post
                </button>
              </form>
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-[12px] text-[#8E8E93]">No notes logged yet.</p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-[#ECECE7] bg-[#FAF9F5] p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full text-[9px] font-medium text-white flex items-center justify-center"
                            style={{ backgroundColor: c.authorAvatarColor || "#18181A" }}
                          >
                            {getInitials(c.authorName || "User")}
                          </span>
                          <span className="text-[12px] font-medium text-[#18181A]">
                            {c.authorName || "Team Member"}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#8E8E93]">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-[#3F3F44] leading-relaxed">{c.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
