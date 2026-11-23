"use client";

import React, { useState } from "react";
import {
  ArrowUpDown,
  Calendar,
  ChevronRight,
  Mail,
  MapPin,
  MessageSquare,
  MoreVertical,
  Paperclip,
} from "lucide-react";
import { cn, formatShortDate, getInitials } from "@/lib/utils";

export interface KanbanCardItem {
  id: number;
  code: string;
  title: string;
  description: string;
  stage: string;
  date?: string | Date | null;
  customerName?: string | null;
  customerAddress?: string | null;
  customerEmail?: string | null;
  assigneeName?: string | null;
  assigneeJobTitle?: string | null;
  assigneeAvatarColor?: string | null;
  commentCount?: number;
  attachmentCount?: number;
  badgeText?: string | null;
  badgeTone?: "neutral" | "critical" | "warning" | "success";
  extraLine?: string | null;
}

interface KanbanBoardProps {
  columns: string[];
  items: KanbanCardItem[];
  defaultSelectedId?: number;
  canEdit?: boolean;
  onMoveStage?: (id: number, nextStage: string) => Promise<void> | void;
  onOpenDetail: (item: KanbanCardItem) => void;
}

export function KanbanBoard({
  columns,
  items,
  defaultSelectedId,
  canEdit = false,
  onMoveStage,
  onOpenDetail,
}: KanbanBoardProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    defaultSelectedId ?? items[0]?.id ?? null
  );
  const [columnSortAsc, setColumnSortAsc] = useState<Record<string, boolean>>({});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
      {columns.map((col, colIdx) => {
        const asc = columnSortAsc[col] ?? false;
        const colItems = items
          .filter((item) => item.stage === col)
          .sort((a, b) =>
            asc ? a.title.localeCompare(b.title) : b.id - a.id
          );

        const nextStage = columns[colIdx + 1];

        return (
          <div key={col} className="min-w-0">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-medium tracking-tight text-[#18181A] truncate">
                {col}
              </h2>
              <button
                type="button"
                onClick={() =>
                  setColumnSortAsc((prev) => ({ ...prev, [col]: !asc }))
                }
                title="Sort column"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border border-[#E5E5DF] bg-white text-[12px] font-medium text-[#525258] hover:border-[#C9C9C0] transition-colors tabular-nums shrink-0"
              >
                <span>{colItems.length}</span>
                <ArrowUpDown className="w-3 h-3 text-[#78787E]" />
              </button>
            </div>

            {/* Cards Stack */}
            <div className="space-y-3.5">
              {colItems.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-[#E4E4DE] px-4 py-8 text-center text-[12.5px] text-[#9A9AA0]">
                  No items in {col}
                </div>
              ) : (
                colItems.map((card) => {
                  const isDark = selectedId === card.id;
                  return (
                    <div
                      key={card.id}
                      onClick={() => setSelectedId(card.id)}
                      className={cn(
                        "rounded-[14px] p-4 transition-all cursor-pointer border",
                        isDark
                          ? "bg-[#19191B] text-white border-[#19191B] shadow-[0_12px_30px_rgba(24,24,26,0.16)]"
                          : "bg-white text-[#18181A] border-[#ECECE7] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#D3D3CB]"
                      )}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={cn(
                                "font-mono text-[10.5px]",
                                isDark ? "text-zinc-400" : "text-[#8E8E93]"
                              )}
                            >
                              {card.code}
                            </span>
                            {card.badgeText && (
                              <span
                                className={cn(
                                  "text-[10.5px] font-medium px-1.5 py-0.5 rounded-md",
                                  isDark
                                    ? "bg-white/10 text-zinc-200"
                                    : card.badgeTone === "critical"
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : card.badgeTone === "warning"
                                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                                        : card.badgeTone === "success"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : "bg-[#F4F4F1] text-[#525258]"
                                )}
                              >
                                {card.badgeText}
                              </span>
                            )}
                          </div>
                          <h3 className="text-[15px] font-semibold leading-snug truncate">
                            {card.title}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetail(card);
                          }}
                          title="Inspect & edit"
                          className={cn(
                            "p-1 rounded-md transition-colors shrink-0",
                            isDark
                              ? "text-zinc-400 hover:text-white hover:bg-white/10"
                              : "text-[#8E8E93] hover:text-[#18181A] hover:bg-[#F4F4F1]"
                          )}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Description */}
                      <p
                        className={cn(
                          "mt-2 text-[12.5px] leading-relaxed line-clamp-2",
                          isDark ? "text-zinc-300" : "text-[#78787E]"
                        )}
                      >
                        {card.description}
                      </p>

                      {/* Expanded Dark Focus Details (matches Prime Estate in screenshot!) */}
                      {isDark && (
                        <div className="mt-3.5 pt-3 border-t border-white/10 space-y-2 text-[12px]">
                          {(card.customerAddress || card.customerName) && (
                            <div className="flex items-start gap-2 text-zinc-300">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 text-zinc-400 shrink-0" />
                              <span className="truncate">
                                {card.customerAddress || card.customerName}
                              </span>
                            </div>
                          )}
                          {(card.customerEmail || card.extraLine) && (
                            <div className="flex items-center gap-2 text-zinc-300">
                              <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="truncate">
                                {card.customerEmail || card.extraLine}
                              </span>
                            </div>
                          )}
                          {card.assigneeName && (
                            <div className="flex items-center justify-between pt-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white ring-1 ring-white/20 shrink-0"
                                  style={{
                                    backgroundColor: card.assigneeAvatarColor || "#3F3F46",
                                  }}
                                >
                                  {getInitials(card.assigneeName)}
                                </div>
                                <div className="min-w-0 leading-tight">
                                  <div className="text-[10px] text-zinc-400">Owner</div>
                                  <div className="text-[12px] font-medium text-white truncate">
                                    {card.assigneeName}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {canEdit && nextStage && onMoveStage && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void onMoveStage(card.id, nextStage);
                                    }}
                                    title={`Move to ${nextStage}`}
                                    className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-medium text-white transition-colors"
                                  >
                                    <span>Advance</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenDetail(card);
                                  }}
                                  className="px-2 py-1 rounded-md bg-white text-[#18181A] hover:bg-zinc-200 text-[11px] font-medium transition-colors"
                                >
                                  Open
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer row */}
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-[7px] text-[11.5px] font-medium border",
                            isDark
                              ? "border-white/15 text-zinc-200 bg-white/5"
                              : "border-[#E6E6DF] text-[#3F3F44] bg-white"
                          )}
                        >
                          <Calendar className="w-3 h-3 opacity-75" />
                          <span>{formatShortDate(card.date)}</span>
                        </span>

                        <div
                          className={cn(
                            "flex items-center gap-2.5 text-[11.5px] tabular-nums",
                            isDark ? "text-zinc-300" : "text-[#78787E]"
                          )}
                        >
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {card.commentCount ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="w-3.5 h-3.5" />
                            {card.attachmentCount ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
