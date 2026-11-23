"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowDownWideNarrow, Plus, Search, SlidersHorizontal, User } from "lucide-react";
import { WeeklyBarsChart, WeeklyBarPoint } from "./WeeklyBarsChart";
import { RadialTickGauge } from "./RadialTickGauge";
import { cn } from "@/lib/utils";

interface HeaderAnalyticsBandProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortDir?: "asc" | "desc";
  onToggleSort?: () => void;
  showFilters?: boolean;
  onToggleFilters?: () => void;
  onlyMine?: boolean;
  onToggleOnlyMine?: () => void;
  ctaLabel?: string;
  onCtaClick?: () => void;
  filterBar?: React.ReactNode;
  barTitle?: string;
  weeklyData?: WeeklyBarPoint[];
  gaugePct?: number;
  gaugeLabel?: string;
  kpi1Value?: string | number;
  kpi1Label?: string;
  kpi1Href?: string;
  kpi2Value?: string | number;
  kpi2Label?: string;
  kpi2Href?: string;
  compact?: boolean;
}

export function HeaderAnalyticsBand({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search records...",
  sortDir,
  onToggleSort,
  showFilters,
  onToggleFilters,
  onlyMine,
  onToggleOnlyMine,
  ctaLabel,
  onCtaClick,
  filterBar,
  barTitle = "Weekly activity",
  weeklyData = [
    { day: "Mon", preventive: 4, corrective: 7 },
    { day: "Tue", preventive: 5, corrective: 10 },
    { day: "Wed", preventive: 4, corrective: 9 },
    { day: "Thu", preventive: 2, corrective: 4 },
    { day: "Fri", preventive: 7, corrective: 10 },
  ],
  gaugePct = 68,
  gaugeLabel = "SLA compliance",
  kpi1Value = "53",
  kpi1Label = "Tasks in progress",
  kpi1Href = "/corrective",
  kpi2Value = "$ 15.890",
  kpi2Label = "Monthly recurring value",
  kpi2Href = "/services",
  compact = false,
}: HeaderAnalyticsBandProps) {
  return (
    <section className="bg-[#F3F3EB] border-b border-[#E8E8DF] px-6 lg:px-8 pt-5 pb-7">
      {/* Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[210px] max-w-md">
          <Search className="w-4 h-4 text-[#78787E] absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent pl-7 pr-3 py-1.5 text-[13.5px] text-[#18181A] placeholder:text-[#8E8E93] focus:outline-none border-b border-transparent focus:border-[#D4D4CB] transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {onToggleSort && (
            <button
              type="button"
              onClick={onToggleSort}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#3F3F44] hover:bg-black/5 transition-colors"
            >
              <ArrowDownWideNarrow className="w-3.5 h-3.5" />
              <span>Sort {sortDir === "asc" ? "↑" : "↓"}</span>
            </button>
          )}
          {onToggleFilters && (
            <button
              type="button"
              onClick={onToggleFilters}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                showFilters
                  ? "bg-[#18181A] text-white"
                  : "text-[#3F3F44] hover:bg-black/5"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
          )}
          {onToggleOnlyMine && (
            <button
              type="button"
              onClick={onToggleOnlyMine}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                onlyMine
                  ? "bg-[#18181A] text-white"
                  : "text-[#3F3F44] hover:bg-black/5"
              )}
            >
              <User className="w-3.5 h-3.5" />
              <span>Me</span>
            </button>
          )}
          {ctaLabel && onCtaClick && (
            <button
              type="button"
              onClick={onCtaClick}
              className="inline-flex items-center gap-1.5 bg-[#18181A] hover:bg-[#2C2C30] text-white rounded-[10px] px-4 py-2 text-[13px] font-medium shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{ctaLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Expandable Filter Strip */}
      {showFilters && filterBar && <div className="mt-4 pt-3 border-t border-[#E6E6DC]">{filterBar}</div>}

      {/* Analytics Row */}
      {!compact && (
        <div className="mt-7 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-6 items-end">
          <div className="xl:col-span-4">
            <WeeklyBarsChart title={barTitle} data={weeklyData} />
          </div>

          <div className="xl:col-span-4 flex justify-start md:justify-center">
            <RadialTickGauge percentage={gaugePct} label={gaugeLabel} />
          </div>

          <div className="xl:col-span-2 flex flex-col justify-end">
            <div className="text-[32px] font-medium leading-none tracking-tight text-[#18181A] tabular-nums">
              {kpi1Value}
            </div>
            <Link
              href={kpi1Href}
              className="mt-4 flex items-center justify-between gap-2 text-[12px] text-[#5E5E64] hover:text-[#18181A] group"
            >
              <span className="leading-snug max-w-[110px]">{kpi1Label}</span>
              <ArrowRight className="w-4 h-4 text-[#18181A] transition-transform group-hover:translate-x-0.5 shrink-0" />
            </Link>
          </div>

          <div className="xl:col-span-2 flex flex-col justify-end">
            <div className="text-[32px] font-medium leading-none tracking-tight text-[#18181A] tabular-nums">
              {kpi2Value}
            </div>
            <Link
              href={kpi2Href}
              className="mt-4 flex items-center justify-between gap-2 text-[12px] text-[#5E5E64] hover:text-[#18181A] group"
            >
              <span className="leading-snug max-w-[125px]">{kpi2Label}</span>
              <ArrowRight className="w-4 h-4 text-[#18181A] transition-transform group-hover:translate-x-0.5 shrink-0" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
