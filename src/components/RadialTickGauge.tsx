"use client";

import React from "react";

export function RadialTickGauge({
  percentage,
  label = "SLA Compliance",
}: {
  percentage: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const totalTicks = 36;
  const activeTicks = Math.round((clamped / 100) * totalTicks);
  const cx = 100;
  const cy = 92;
  const rInner = 64;
  const rOuter = 82;

  const ticks = Array.from({ length: totalTicks }, (_, i) => {
    // Sweep from -180deg (left) to 0deg (right)
    const angleRad = Math.PI + (i / (totalTicks - 1)) * Math.PI;
    const x1 = cx + rInner * Math.cos(angleRad);
    const y1 = cy + rInner * Math.sin(angleRad);
    const x2 = cx + rOuter * Math.cos(angleRad);
    const y2 = cy + rOuter * Math.sin(angleRad);
    const isActive = i < activeTicks;
    return { i, x1, y1, x2, y2, isActive };
  });

  return (
    <div className="flex flex-col items-center justify-end">
      <div className="relative w-[196px] h-[106px]">
        <svg
          viewBox="0 0 200 104"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`${clamped}% ${label}`}
        >
          {ticks.map((t) => (
            <line
              key={t.i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isActive ? "#18181A" : "#D3D3CB"}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
          <span className="text-[28px] leading-none font-semibold tracking-tight text-[#18181A] tabular-nums">
            {clamped}%
          </span>
          <span className="mt-1.5 text-[11px] font-normal text-[#78787E]">{label}</span>
        </div>
      </div>
    </div>
  );
}
