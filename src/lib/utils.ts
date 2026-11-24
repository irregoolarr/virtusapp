import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatShortDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "No due date";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return "No due date";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const idrFormat = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const idrCompact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** All amounts in the app are Rupiah, e.g. "Rp 27.050.000". */
export function formatCurrency(amount: number): string {
  return idrFormat.format(amount).replace(/\u00a0/g, " ");
}

/** Short Rupiah for charts, e.g. "Rp 41,2 jt" / "Rp 1,2 M". */
export function formatCurrencyCompact(amount: number): string {
  return `Rp ${idrCompact.format(amount)}`;
}

/** USD is informational only (dashboard exchange-rate note). */
export function formatUsd(amount: number): string {
  return usdFormat.format(amount);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function computeNextRunDate(current: Date, recurrence: string): Date {
  const next = new Date(current);
  switch (recurrence) {
    case "Daily":
      next.setDate(next.getDate() + 1);
      break;
    case "Weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "Monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      break;
  }
  return next;
}
