"use client";

import React from "react";

export interface WeeklyBarPoint {
  day: string;
  preventive: number;
  corrective: number;
}

export function WeeklyBarsChart({
  title = "Weekly workload",
  data,
}: {
  title?: string;
  data: WeeklyBarPoint[];
}) {
  const maxVal = Math.max(
    10,
    ...data.flatMap((d) => [d.preventive, d.corrective])
  );
  const roundedTop = Math.ceil(maxVal / 5) * 5;
  const midTick = Math.round(roundedTop / 2);

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="text-[13px] font-medium text-[#18181A] mb-3">{title}</div>
      <div className="flex items-end gap-3">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between h-[84px] text-[10px] text-[#78787E] tabular-nums pb-[18px] pr-1 select-none">
          <span>{roundedTop}</span>
          <span>{midTick}</span>
          <span>0</span>
        </div>

        <svg
          viewBox="0 0 220 92"
          className="w-full max-w-[235px] h-[92px] overflow-visible"
          role="img"
          aria-label={title}
        >
          <defs>
            <pattern
              id="virtusDiagonalHatch"
              width="4"
              height="4"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="4"
                stroke="#B9B9B0"
                strokeWidth="2"
              />
            </pattern>
          </defs>

          {data.map((point, idx) => {
            const groupX = idx * 43 + 4;
            const maxH = 66;
            const h1 = Math.max(6, Math.round((point.preventive / roundedTop) * maxH));
            const h2 = Math.max(6, Math.round((point.corrective / roundedTop) * maxH));
            const y1 = 70 - h1;
            const y2 = 70 - h2;

            return (
              <g key={point.day} className="group">
                <title>
                  {point.day}: {point.preventive} planned / {point.corrective} active
                </title>
                <rect
                  x={groupX}
                  y={y1}
                  width="12"
                  height={h1}
                  rx="3"
                  fill="url(#virtusDiagonalHatch)"
                  className="transition-opacity group-hover:opacity-80"
                />
                <rect
                  x={groupX + 16}
                  y={y2}
                  width="12"
                  height={h2}
                  rx="3"
                  fill="#18181A"
                  className="transition-opacity group-hover:opacity-85"
                />
                <text
                  x={groupX + 14}
                  y={87}
                  textAnchor="middle"
                  className="fill-[#6B6B70] text-[10px] font-medium"
                >
                  {point.day}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
