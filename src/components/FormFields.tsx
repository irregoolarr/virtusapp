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
      <span className="text-[12px] font-medium text-[#525258]">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-[10px] border border-[#E2E2DA] bg-white px-3 py-2 text-[13px] text-[#18181A] placeholder:text-[#9A9AA0] focus:outline-none focus:border-[#18181A] transition-colors";

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
    <div className="pt-4 border-t border-[#ECECE7] flex items-center justify-end gap-2.5">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-[10px] border border-[#E2E2DA] text-[13px] font-medium text-[#525258] hover:bg-[#F4F4F1] transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving || disabled}
        className={cn(
          "px-4 py-2 rounded-[10px] bg-[#18181A] hover:bg-[#2C2C30] text-white text-[13px] font-medium transition-colors disabled:opacity-45"
        )}
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
