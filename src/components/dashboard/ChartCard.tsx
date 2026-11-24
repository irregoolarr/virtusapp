import React from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";

export function ChartCard({
  title,
  subtitle,
  href,
  hrefLabel = "Open module",
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-md border border-[#E2E8F0] bg-white p-5 flex flex-col min-w-0 ${className}`}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#0F172A]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-[#64748B] truncate">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            title={hrefLabel}
            aria-label={hrefLabel}
            className="shrink-0 w-8 h-8 rounded-md border border-[#E2E8F0] flex items-center justify-center text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Link>
        )}
      </header>
      <div className="flex-1 min-h-0 flex flex-col justify-center">{children}</div>
    </section>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-[#475569]">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-full min-h-[160px] flex items-center justify-center text-[12.5px] text-[#64748B]">
      {message}
    </div>
  );
}
