import React from "react";
import Link from "next/link";

type Tone = "good" | "bad" | "warn" | "neutral";

const TONE: Record<Tone, { text: string; tile: string; icon: string }> = {
  good: { text: "text-[#15803D]", tile: "bg-[#ECFDF3]", icon: "text-[#16A34A]" },
  bad: { text: "text-[#DC2626]", tile: "bg-[#FEF2F2]", icon: "text-[#DC2626]" },
  warn: { text: "text-[#B45309]", tile: "bg-[#FFFBEB]", icon: "text-[#D97706]" },
  neutral: { text: "text-[#475569]", tile: "bg-[#F1F5F9]", icon: "text-[#475569]" },
};

export function KpiCard({
  value,
  label,
  note,
  tone = "neutral",
  icon: Icon,
  href,
}: {
  value: React.ReactNode;
  label: string;
  note?: string;
  tone?: Tone;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      className="rounded-md border border-[#E2E8F0] bg-white px-5 py-4 flex items-center justify-between gap-4 hover:border-[#CBD5E1] hover:shadow-sm transition-all"
    >
      <div className="min-w-0">
        <div className="text-[26px] leading-tight font-semibold tabular-nums text-[#0F172A] truncate">
          {value}
        </div>
        <div className="mt-1 text-[13px] text-[#475569] leading-snug">
          {label}
          {note && <span className={`ml-1.5 font-medium whitespace-nowrap ${t.text}`}>{note}</span>}
        </div>
      </div>
      <div className={`shrink-0 w-12 h-12 rounded-md flex items-center justify-center ${t.tile}`}>
        <Icon className={`w-5 h-5 ${t.icon}`} />
      </div>
    </Link>
  );
}
