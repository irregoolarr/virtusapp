"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small modal window (Multisort picker, Resolve, unsaved-changes prompt...).
 * ESC closes it and does not reach dialogs/drawers underneath.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    // Capture phase so this runs before the record drawer's ESC handler.
    window.addEventListener("keydown", onKey, true);
    const focusable = panelRef.current?.querySelector<HTMLElement>("textarea, input, select, button[data-autofocus]");
    focusable?.focus();
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-black/30 p-4" role="presentation">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("dialog-in relative w-full bg-white border border-[#D9DEE3] shadow-xl", width)}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9ECEF]">
          <h2 className="text-[15px] font-semibold text-[#2B3036]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1668AC] hover:text-[#0F4F86]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-1 px-5 py-3 border-t border-[#E9ECEF]">{footer}</div>}
      </div>
    </div>
  );
}

/** Text-style button used in dialog footers and toolbars. */
export function TextButton({
  children,
  onClick,
  type = "button",
  disabled,
  tone = "default",
  autoFocus,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
  autoFocus?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-autofocus={autoFocus ? "" : undefined}
      className={cn(
        "h-8 px-3 text-[12.5px] font-semibold uppercase tracking-[0.02em] transition-colors disabled:opacity-40",
        tone === "primary" && "bg-[#1668AC] text-white hover:bg-[#0F4F86]",
        tone === "danger" && "text-[#B42318] hover:bg-[#FEF2F2]",
        tone === "default" && "text-[#1668AC] hover:bg-[#EDF2F6]"
      )}
    >
      {children}
    </button>
  );
}
