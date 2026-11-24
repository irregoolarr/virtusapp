"use client";

import React, { useState } from "react";
import { INK } from "./chartUtils";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
  meta?: string;
}

export function DonutChart({
  slices,
  centerLabel,
  formatValue,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  formatValue: (n: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const size = 200;
  const stroke = 30;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 2 : 0; // 2px surface gap

  let offset = 0;
  const arcs = slices.map((s, i) => {
    const len = total > 0 ? (s.value / total) * c : 0;
    const arc = { i, start: offset, len };
    offset += len;
    return arc;
  });

  const focus = active !== null ? slices[active] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={INK.grid} strokeWidth={stroke} />
          {arcs.map(({ i, start, len }) =>
            len > 0 ? (
              <circle
                key={slices[i].label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={slices[i].color}
                strokeWidth={active === i ? stroke + 4 : stroke}
                strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
                strokeDashoffset={-start}
                opacity={active === null || active === i ? 1 : 0.35}
                className="transition-all cursor-pointer"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <title>{`${slices[i].label}: ${formatValue(slices[i].value)}`}</title>
              </circle>
            ) : null
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-8">
          <div className="text-[20px] font-semibold tabular-nums text-[#0F172A] leading-tight">
            {formatValue(focus ? focus.value : total)}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#64748B]">{focus ? focus.label : centerLabel}</div>
        </div>
      </div>

      <ul className="w-full space-y-3">
        {slices.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li
              key={s.label}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="flex items-center gap-2.5 text-[12.5px] cursor-default"
            >
              <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ backgroundColor: s.color }} />
              <span className="flex-1 min-w-0 truncate text-[#0F172A]">
                {s.label}
                {s.meta && <span className="ml-1 text-[#64748B]">· {s.meta}</span>}
              </span>
              <span className="tabular-nums text-[#0F172A]">{formatValue(s.value)}</span>
              <span className="w-9 text-right tabular-nums text-[#64748B]">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
