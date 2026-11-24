"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function FieldLabel({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-[#4B5563]">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-sm border border-[#C9D0D7] bg-white px-3 py-2 text-[13px] text-[#2B3036] placeholder:text-[#8A94A0] focus:outline-none focus:border-[#1668AC] transition-colors";

export function FormActions({
  onCancel,
  saving,
  submitLabel = "Save Record",
  disabled = false,
}: {
  onCancel: () => void;
  saving?: boolean;
  submitLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="pt-4 border-t border-[#D9DEE3] flex items-center justify-end gap-2.5">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-sm border border-[#C9D0D7] text-[13px] font-medium text-[#4B5563] hover:bg-[#EEF1F4] transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving || disabled}
        className={cn(
          "px-4 py-2 rounded-sm bg-[#1668AC] hover:bg-[#0F4F86] text-white text-[13px] font-medium transition-colors disabled:opacity-45"
        )}
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
