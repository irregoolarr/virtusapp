import React from "react";
import Link from "next/link";

type Tone = "good" | "bad" | "warn" | "neutral";

const TONE: Record<Tone, string> = {
  good: "text-[#15803D]",
  bad: "text-[#D92023]",
  warn: "text-[#B45309]",
  neutral: "text-[#6B7280]",
};

export interface Kpi {
  label: string;
  value: React.ReactNode;
  note?: string;
  tone?: Tone;
  href: string;
}

/** One panel, four figures separated by rules. */
export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <section className="bg-white border border-[#D9DEE3] grid grid-cols-2 xl:grid-cols-4">
      {items.map((k, i) => (
        <Link
          key={k.label}
          href={k.href}
          className={[
            "px-5 py-4 hover:bg-[#F6F7F8] transition-colors",
            i % 2 === 1 ? "border-l border-[#E9ECEF]" : "",
            i >= 2 ? "border-t xl:border-t-0 border-[#E9ECEF]" : "",
            i === 2 ? "xl:border-l" : "",
          ].join(" ")}
        >
          <div className="text-[12.5px] text-[#4B5563]">{k.label}</div>
          <div className="mt-1 text-[26px] leading-tight font-semibold tabular-nums text-[#2B3036]">{k.value}</div>
          <div className={`mt-0.5 text-[12px] min-h-4 ${TONE[k.tone ?? "neutral"]}`}>{k.note ?? ""}</div>
        </Link>
      ))}
    </section>
  );
}
