"use client";

import React, { useState } from "react";
import { Legend } from "./ChartCard";
import { niceTicks } from "./chartUtils";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

type Row = { label: string } & Record<string, number | string>;

function YAxisGrid({ ticks, height }: { ticks: number[]; height: number }) {
  const top = ticks[ticks.length - 1] || 1;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height }}>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute left-0 right-0 flex items-center"
          style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}
        >
          <span className="w-8 pr-2 text-right text-[11px] tabular-nums text-[#64748B]">{t}</span>
          <span className="flex-1 border-t border-[#E2E8F0]" />
        </div>
      ))}
    </div>
  );
}

function Tooltip({ title, rows }: { title: string; rows: Array<{ label: string; color: string; value: number }> }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap rounded-md bg-[#0F172A] px-3 py-2 text-[11.5px] text-white shadow-lg pointer-events-none">
      <div className="font-semibold mb-1">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: r.color }} />
          <span className="text-white/80">{r.label}</span>
          <span className="ml-auto pl-3 tabular-nums font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Side-by-side bars per category (one axis, shared scale). */
export function GroupedBarChart({
  rows,
  series,
  height = 220,
}: {
  rows: Row[];
  series: BarSeries[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0)));
  const ticks = niceTicks(max, 4);
  const top = ticks[ticks.length - 1] || 1;

  return (
    <div>
      <div className="relative" style={{ height }}>
        <YAxisGrid ticks={ticks} height={height} />
        <div className="absolute inset-0 left-8 flex items-end">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="relative flex-1 h-full flex items-end justify-center gap-[2px] rounded-sm"
              style={{ backgroundColor: hover === i ? "rgba(241,245,249,0.7)" : undefined }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {series.map((s) => {
                const v = Number(r[s.key]) || 0;
                return (
                  <div
                    key={s.key}
                    className="w-[10px] rounded-t-[4px]"
                    style={{ height: `${(v / top) * 100}%`, backgroundColor: s.color }}
                  />
                );
              })}
              {hover === i && (
                <Tooltip
                  title={r.label}
                  rows={series.map((s) => ({ label: s.label, color: s.color, value: Number(r[s.key]) || 0 }))}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-8 mt-2 flex">
        {rows.map((r) => (
          <div key={r.label} className="flex-1 min-w-0 text-center text-[10px] sm:text-[11px] text-[#64748B] whitespace-nowrap">
            {r.label}
          </div>
        ))}
      </div>
      <div className="mt-4 ml-8">
        <Legend items={series} />
      </div>
    </div>
  );
}

/** Stacked bars per category; series stack bottom-up in the given order. */
export function StackedBarChart({
  rows,
  series,
  height = 220,
}: {
  rows: Row[];
  series: BarSeries[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = rows.map((r) => series.reduce((s, x) => s + (Number(r[x.key]) || 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals), 4);
  const top = ticks[ticks.length - 1] || 1;

  return (
    <div>
      <div className="relative" style={{ height }}>
        <YAxisGrid ticks={ticks} height={height} />
        <div className="absolute inset-0 left-8 flex items-end gap-3 px-2">
          {rows.map((r, i) => {
            const visible = series.filter((s) => (Number(r[s.key]) || 0) > 0);
            return (
              <div
                key={r.label}
                className="relative flex-1 h-full flex items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className="w-full max-w-[56px] flex flex-col-reverse gap-[2px]"
                  style={{ height: `${(totals[i] / top) * 100}%` }}
                >
                  {visible.map((s, si) => (
                    <div
                      key={s.key}
                      className={si === visible.length - 1 ? "rounded-t-[4px]" : ""}
                      style={{
                        flexGrow: Number(r[s.key]) || 0,
                        flexBasis: 0,
                        backgroundColor: s.color,
                        opacity: hover === null || hover === i ? 1 : 0.55,
                      }}
                    />
                  ))}
                </div>
                {hover === i && (
                  <Tooltip
                    title={r.label}
                    rows={series.map((s) => ({ label: s.label, color: s.color, value: Number(r[s.key]) || 0 }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-8 mt-2 flex gap-3 px-2">
        {rows.map((r) => (
          <div key={r.label} className="flex-1 text-center text-[11.5px] text-[#475569] truncate" title={r.label}>
            {r.label}
          </div>
        ))}
      </div>
      <div className="mt-4 ml-8">
        <Legend items={series} />
      </div>
    </div>
  );
}
