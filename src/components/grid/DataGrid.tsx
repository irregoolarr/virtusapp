"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Plus,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Dialog, TextButton } from "@/components/Dialog";
import { cn } from "@/lib/utils";

export interface GridColumn<T> {
  key: string;
  header: string;
  /** Fixed column width in px. */
  width?: number;
  /** Cell content; defaults to the sort/export value. */
  render?: (row: T) => React.ReactNode;
  /** Value used for sorting and CSV export; defaults to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
  /** Allow text to wrap onto two lines instead of truncating. */
  wrap?: boolean;
}

export interface GridAction<T> {
  label: string;
  onClick: (selected: T | null) => void;
  /** Requires a selected row. */
  needsSelection?: boolean;
  /** Only enabled when the selected row passes this check (implies needsSelection). */
  enabledFor?: (row: T) => boolean;
  disabled?: boolean;
  hidden?: boolean;
  active?: boolean;
  tone?: "danger";
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SortKey {
  key: string;
  dir: "asc" | "desc";
}

interface DataGridProps<T> {
  title?: string;
  columns: GridColumn<T>[];
  rows: T[];
  getRowId: (row: T) => number | string;
  actions?: GridAction<T>[];
  /** Extra controls (selects) rendered on the right side of the toolbar. */
  filters?: React.ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  /** True while data is (re)loading: skeleton rows on first load, a progress bar after. */
  loading?: boolean;
  onOpen?: (row: T) => void;
  onSelectionChange?: (row: T | null) => void;
  rowTone?: (row: T) => "critical" | undefined;
  detail?: (row: T) => React.ReactNode;
  exportName?: string;
  emptyMessage?: string;
  /**
   * "page" (default): title, full toolbar, pager.
   * "panel": action buttons only, no pager (grids inside a record).
   * "embedded": table only.
   */
  variant?: "page" | "panel" | "embedded";
  /** @deprecated use variant="embedded" */
  embedded?: boolean;
  defaultPageSize?: number;
  maxHeight?: string;
}

function readValue<T>(col: GridColumn<T>, row: T): string | number | null | undefined {
  if (col.value) return col.value(row);
  const v = (row as Record<string, unknown>)[col.key];
  return typeof v === "number" || typeof v === "string" ? v : v == null ? null : String(v);
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

const toolbarBtn =
  "h-8 px-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[0.02em] whitespace-nowrap transition-colors disabled:text-[#A7B0BA] disabled:cursor-not-allowed";
const iconBtn = "h-8 w-8 flex items-center justify-center text-[#1668AC] hover:text-[#0F4F86] hover:bg-[#EDF2F6] disabled:opacity-40";

export function DataGrid<T>({
  title,
  columns,
  rows,
  getRowId,
  actions = [],
  filters,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  onRefresh,
  loading = false,
  onOpen,
  onSelectionChange,
  rowTone,
  detail,
  exportName,
  emptyMessage = "No records found",
  variant: variantProp,
  embedded = false,
  defaultPageSize = 50,
  maxHeight,
}: DataGridProps<T>) {
  const variant = variantProp ?? (embedded ? "embedded" : "page");
  const isPage = variant === "page";

  const [sorts, setSorts] = useState<SortKey[]>([]);
  const [sortVersion, setSortVersion] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (sorts.length === 0) return rows;
    const cols = new Map(columns.map((c) => [c.key, c]));
    return [...rows].sort((a, b) => {
      for (const s of sorts) {
        const col = cols.get(s.key);
        if (!col) continue;
        const r = compare(readValue(col, a), readValue(col, b));
        if (r !== 0) return s.dir === "asc" ? r : -r;
      }
      return 0;
    });
  }, [rows, sorts, columns]);

  const pageCount = isPage ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = isPage ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;
  const selected = rows.find((r) => getRowId(r) === selectedId) ?? null;
  const firstLoad = loading && rows.length === 0;

  useEffect(() => {
    if (selectedId !== null && !selected) setSelectedId(null);
  }, [selected, selectedId]);

  useEffect(() => {
    onSelectionChange?.(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const applySorts = (next: SortKey[]) => {
    setSorts(next);
    setSortVersion((v) => v + 1); // re-keys the body so the fade plays once
  };

  /** Header click: sort by this column (Shift+click adds it as a secondary sort). */
  const toggleSort = (key: string, additive: boolean) => {
    const existing = sorts.find((s) => s.key === key);
    const next: SortKey | null = !existing ? { key, dir: "asc" } : existing.dir === "asc" ? { key, dir: "desc" } : null;
    if (additive) {
      const rest = sorts.filter((s) => s.key !== key);
      applySorts(next ? (existing ? sorts.map((s) => (s.key === key ? next : s)) : [...rest, next]) : rest);
    } else {
      applySorts(next ? [next] : []);
    }
  };

  const exportCsv = () => {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      columns.map((c) => esc(c.header)).join(","),
      ...sorted.map((r) => columns.map((c) => esc(readValue(c, r))).join(",")),
    ];
    // BOM so Excel opens UTF-8 (e.g. "Rp", accented names) correctly.
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleActions = actions.filter((a) => !a.hidden);

  const renderActions = () =>
    visibleActions.map((a) => {
      const disabled =
        a.disabled || ((a.needsSelection || a.enabledFor) && !selected) || Boolean(selected && a.enabledFor && !a.enabledFor(selected));
      const Icon = a.icon;
      return (
        <button
          key={a.label}
          type="button"
          disabled={disabled}
          onClick={() => a.onClick(selected)}
          aria-pressed={a.active}
          className={cn(
            toolbarBtn,
            a.tone === "danger" ? "text-[#B42318] hover:text-[#8A1A12]" : "text-[#1668AC] hover:text-[#0F4F86]",
            a.active && "underline underline-offset-4 decoration-2"
          )}
        >
          {Icon && <Icon className="w-4 h-4" />}
          {a.label}
        </button>
      );
    });

  return (
    <section
      className={cn(
        "bg-white flex flex-col min-w-0",
        variant !== "embedded" && "border border-[#D9DEE3]",
        isPage && "shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      )}
    >
      {title && isPage && (
        <div className="px-4 pt-3 flex items-baseline gap-2">
          <h1 className="text-[16px] font-semibold text-[#2B3036]">{title}</h1>
          <span className="text-[12.5px] text-[#6B7280] tabular-nums">{rows.length} records</span>
        </div>
      )}

      {variant === "panel" && visibleActions.length > 0 && (
        <div className="flex flex-wrap items-center px-1.5 py-1 border-b border-[#D9DEE3]">{renderActions()}</div>
      )}

      {isPage && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2.5 py-1.5 border-b border-[#D9DEE3]">
          <div className="flex flex-wrap items-center">
            {renderActions()}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              title="Sort by several columns"
              className={cn(toolbarBtn, "text-[#1668AC] hover:text-[#0F4F86]", sorts.length > 1 && "underline underline-offset-4 decoration-2")}
            >
              Multisort
            </button>
            {onRefresh && (
              <button type="button" onClick={onRefresh} disabled={loading} title="Refresh" aria-label="Refresh" className={iconBtn}>
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filters}
            {onSearchChange && (
              <label className="relative flex items-center">
                <Search className="absolute left-2 w-3.5 h-3.5 text-[#8A94A0] pointer-events-none" />
                <input
                  type="search"
                  value={search ?? ""}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    setPage(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="h-8 w-56 pl-7 pr-2 border border-[#C9D0D7] text-[12.5px] text-[#2B3036] placeholder:text-[#8A94A0] focus:outline-none focus:border-[#1668AC]"
                />
              </label>
            )}
            <button type="button" onClick={() => window.print()} title="Print" aria-label="Print" className={iconBtn}>
              <Printer className="w-4 h-4" />
            </button>
            <button type="button" onClick={exportCsv} disabled={rows.length === 0} title="Export to CSV" aria-label="Export to CSV" className={iconBtn}>
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Thin indeterminate bar while refreshing data that is already shown */}
      <div className="relative h-[2px] overflow-hidden" aria-hidden="true">
        {loading && !firstLoad && <div className="progress-bar absolute inset-y-0 left-0 w-1/4 bg-[#1668AC]" />}
      </div>

      <div
        className={cn(
          "overflow-auto",
          maxHeight ?? (isPage && (detail ? "max-h-[calc(100vh-430px)] min-h-[220px]" : "max-h-[calc(100vh-215px)]"))
        )}
        aria-busy={loading}
      >
        <table className="w-full text-left text-[13px] text-[#2B3036] border-collapse">
          <thead>
            <tr>
              {columns.map((c) => {
                const sIdx = sorts.findIndex((s) => s.key === c.key);
                const s = sIdx >= 0 ? sorts[sIdx] : null;
                return (
                  <th
                    key={c.key}
                    style={c.width ? { width: c.width, minWidth: c.width } : undefined}
                    aria-sort={s ? (s.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "sticky top-0 z-10 bg-white px-3 h-10 font-semibold whitespace-nowrap border-b border-[#D9DEE3] select-none",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => toggleSort(c.key, e.shiftKey)}
                      className="inline-flex items-center gap-1 hover:text-[#1668AC]"
                      title="Sort (Shift+click to add)"
                    >
                      {c.header}
                      {s && (s.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      {s && sorts.length > 1 && <span className="text-[10px] text-[#6B7280]">{sIdx + 1}</span>}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody key={sortVersion} className={sortVersion > 0 ? "grid-fade" : undefined}>
            {firstLoad ? (
              Array.from({ length: isPage ? 8 : 3 }, (_, i) => (
                <tr key={`sk-${i}`} className={i % 2 === 1 ? "bg-[#F6F7F8]" : "bg-white"}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 h-11">
                      <div className="skeleton h-3 rounded-sm" style={{ width: `${45 + ((i * 7 + c.key.length * 5) % 45)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-[#6B7280]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visible.map((row, i) => {
                const id = getRowId(row);
                const isSel = id === selectedId;
                const tone = rowTone?.(row);
                return (
                  <tr
                    key={id}
                    tabIndex={0}
                    aria-selected={isSel}
                    onClick={() => setSelectedId(id)}
                    onDoubleClick={() => onOpen?.(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onOpen?.(row);
                    }}
                    className={cn(
                      "cursor-default outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1668AC]",
                      isSel ? "bg-[#D7E3EC]" : i % 2 === 1 ? "bg-[#F6F7F8] hover:bg-[#EDF2F6]" : "bg-white hover:bg-[#EDF2F6]",
                      tone === "critical" && "text-[#D92023]"
                    )}
                  >
                    {columns.map((c) => {
                      const content = c.render ? c.render(row) : readValue(c, row) ?? "";
                      return (
                        <td
                          key={c.key}
                          style={c.width ? { width: c.width, maxWidth: c.width } : undefined}
                          className={cn(
                            "px-3 py-2 align-middle h-11",
                            c.wrap ? "leading-[1.45]" : "whitespace-nowrap overflow-hidden text-ellipsis",
                            c.align === "right" && "text-right tabular-nums",
                            c.align === "center" && "text-center"
                          )}
                        >
                          {c.wrap ? <span className="line-clamp-2">{content}</span> : content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isPage && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-[#D9DEE3] text-[13px] text-[#2B3036]">
          <label className="flex items-center gap-2">
            Page Size
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="h-7 w-28 px-1.5 border border-[#C9D0D7] bg-white focus:outline-none focus:border-[#1668AC]"
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1 text-[#1668AC]">
            <PagerBtn label="First page" disabled={safePage === 0} onClick={() => setPage(0)} icon={ChevronFirst} />
            <PagerBtn label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} icon={ChevronLeft} />
            <span className="mx-2 flex items-center gap-1.5 text-[#2B3036]">
              Page
              <input
                value={safePage + 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1 && n <= pageCount) setPage(n - 1);
                }}
                className="h-7 w-10 px-1.5 border border-[#C9D0D7] text-center tabular-nums focus:outline-none focus:border-[#1668AC]"
                aria-label="Page number"
              />
              of {pageCount}
            </span>
            <PagerBtn label="Next page" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} icon={ChevronRight} />
            <PagerBtn label="Last page" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)} icon={ChevronLast} />
          </div>
        </div>
      )}

      {detail && isPage && (
        <div className="border-t-4 border-[#EEF1F4] h-[200px] overflow-y-auto px-6 py-5">
          {selected ? (
            detail(selected)
          ) : (
            <p className="text-[13px] text-[#6B7280]">Select a row to see its details. Double-click a row to open it.</p>
          )}
        </div>
      )}

      {isPage && (
        <MultisortPicker
          open={pickerOpen}
          columns={columns.map((c) => ({ key: c.key, header: c.header }))}
          value={sorts}
          onApply={(next) => {
            applySorts(next);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  );
}

/** "Sort by / Then by" window: pick columns, direction, add/remove levels. */
function MultisortPicker({
  open,
  columns,
  value,
  onApply,
  onClose,
}: {
  open: boolean;
  columns: Array<{ key: string; header: string }>;
  value: SortKey[];
  onApply: (sorts: SortKey[]) => void;
  onClose: () => void;
}) {
  const [levels, setLevels] = useState<Array<{ key: string; dir: "asc" | "desc" }>>([]);
  const options = useMemo(() => [...columns].sort((a, b) => a.header.localeCompare(b.header)), [columns]);

  useEffect(() => {
    if (open) setLevels(value.length > 0 ? value.map((v) => ({ ...v })) : [{ key: "", dir: "asc" }]);
  }, [open, value]);

  const update = (i: number, patch: Partial<SortKey>) => setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const used = new Set(levels.map((l) => l.key));

  return (
    <Dialog
      open={open}
      title="Multisort Column Picker"
      onClose={onClose}
      footer={
        <>
          <TextButton onClick={() => setLevels([{ key: "", dir: "asc" }])}>Reset</TextButton>
          <TextButton tone="primary" onClick={() => onApply(levels.filter((l) => l.key))}>
            Sort
          </TextButton>
          <TextButton onClick={onClose}>Close</TextButton>
        </>
      }
    >
      <div className="space-y-2.5">
        {levels.map((l, i) => (
          <div key={i} className="grid grid-cols-[72px_1fr_auto_auto_auto] items-center gap-2">
            <span className="text-[13px] text-[#2B3036]">{i === 0 ? "Sort by" : "Then by"}</span>
            <select
              value={l.key}
              onChange={(e) => update(i, { key: e.target.value })}
              aria-label={i === 0 ? "Sort by column" : `Then by column ${i}`}
              className="h-8 px-2 border border-[#C9D0D7] bg-white text-[13px] focus:outline-none focus:border-[#1668AC]"
            >
              <option value="">Select a column…</option>
              {options.map((c) => (
                <option key={c.key} value={c.key} disabled={used.has(c.key) && c.key !== l.key}>
                  {c.header}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => update(i, { dir: l.dir === "asc" ? "desc" : "asc" })}
              title={l.dir === "asc" ? "Ascending (click for descending)" : "Descending (click for ascending)"}
              className="h-8 px-2 inline-flex items-center gap-1 text-[12px] text-[#2B3036] hover:bg-[#EDF2F6]"
            >
              {l.dir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              {l.dir === "asc" ? "A→Z" : "Z→A"}
            </button>
            <button
              type="button"
              onClick={() => setLevels((ls) => [...ls.slice(0, i + 1), { key: "", dir: "asc" }, ...ls.slice(i + 1)])}
              disabled={levels.length >= columns.length}
              aria-label="Add sort level"
              className="h-8 w-8 flex items-center justify-center text-[#1668AC] hover:bg-[#EDF2F6] disabled:opacity-30"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLevels((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ key: "", dir: "asc" }]))}
              aria-label="Remove sort level"
              className="h-8 w-8 flex items-center justify-center text-[#8A94A0] hover:text-[#B42318] hover:bg-[#FEF2F2]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function PagerBtn({
  label,
  onClick,
  disabled,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center hover:bg-[#EDF2F6] disabled:text-[#B7C0C9] disabled:hover:bg-transparent"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

/** Page wrapper for grid-style module pages. */
export function GridPage({ children }: { children: React.ReactNode }) {
  return <div className="p-3 sm:p-4 bg-[#EEF1F4] flex-1 flex flex-col gap-4 min-w-0">{children}</div>;
}

/** Small toolbar select used for filters. */
export function GridSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2 border border-[#C9D0D7] bg-white text-[12.5px] text-[#2B3036] focus:outline-none focus:border-[#1668AC]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Flat tab strip shown above a grid. */
export function GridTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: K; label: string }>;
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-[#D9DEE3]" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "relative px-4 py-2.5 text-[13.5px] whitespace-nowrap transition-colors",
            value === t.key ? "text-[#1668AC] font-semibold" : "text-[#4B5563] hover:text-[#2B3036]"
          )}
        >
          {t.label}
          {value === t.key && <span className="absolute left-0 right-0 -bottom-px h-[3px] bg-[#1668AC]" />}
        </button>
      ))}
    </div>
  );
}
