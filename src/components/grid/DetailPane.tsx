import React from "react";

/** Read-only label/value list shown under the grid for the selected record. */
export function DetailList({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2.5 text-[13px]">
      {items.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[150px_1fr] gap-4 items-baseline">
          <dt className="text-right font-semibold text-[#2B3036]">{label}:</dt>
          <dd className="text-[#6B7280] min-w-0 break-words">{value === null || value === undefined || value === "" ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}
