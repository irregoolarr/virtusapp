import React from "react";
import Link from "next/link";

export function ChartCard({
  title,
  subtitle,
  href,
  hrefLabel = "View all",
  className = "",
  flush = false,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
  /** Remove body padding (for embedded grids). */
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-white border border-[#D9DEE3] flex flex-col min-w-0 ${className}`}>
      <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-[#E9ECEF]">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#2B3036]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-[#6B7280] truncate">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.02em] text-[#1668AC] hover:text-[#0F4F86]"
          >
            {hrefLabel}
          </Link>
        )}
      </header>
      <div className={`flex-1 min-h-0 flex flex-col ${flush ? "" : "justify-center p-4"}`}>{children}</div>
    </section>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-[#4B5563]">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return <div className="h-full min-h-[160px] flex items-center justify-center text-[12.5px] text-[#6B7280]">{message}</div>;
}
