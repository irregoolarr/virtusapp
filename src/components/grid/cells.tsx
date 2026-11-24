import React from "react";
import { cn } from "@/lib/utils";

type PillTone = "critical" | "high" | "normal" | "low" | "done";

const PILL: Record<PillTone, string> = {
  critical: "bg-[#FFD0D0] text-[#9F1C1C]",
  high: "bg-[#FFE6BC] text-[#7A4A00]",
  normal: "bg-[#CDEFE4] text-[#0F5C47]",
  low: "bg-[#E4E8ED] text-[#3F4A56]",
  done: "bg-[#DCEBFA] text-[#14507F]",
};

/** Rounded pill like a service-desk priority badge. */
export function Pill({ children, tone = "normal", className }: { children: React.ReactNode; tone?: PillTone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center min-w-[56px] h-6 px-2.5 rounded-full text-[12px] font-medium", PILL[tone], className)}>
      {children}
    </span>
  );
}

export function severityTone(severity: string): PillTone {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "urgent") return "critical";
  if (s === "high") return "high";
  if (s === "low") return "low";
  return "normal";
}

/** Segmented progress (5 blocks). Pass a 0–1 ratio. */
export function SegmentProgress({ ratio, segments = 5 }: { ratio: number; segments?: number }) {
  const filled = Math.max(ratio > 0 ? 1 : 0, Math.round(Math.min(Math.max(ratio, 0), 1) * segments));
  return (
    <span className="inline-flex gap-[2px] align-middle" title={`${Math.round(ratio * 100)}%`}>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cn("w-3 h-[7px]", i < filled ? "bg-[#3BB023]" : "bg-[#DCDFE3]")} />
      ))}
    </span>
  );
}

/** Progress ratio for a record moving through ordered stages. */
export function stageRatio(stages: readonly string[], current: string): number {
  const idx = stages.indexOf(current);
  if (idx < 0) return 0;
  return (idx + 1) / stages.length;
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums">{children}</span>;
}
