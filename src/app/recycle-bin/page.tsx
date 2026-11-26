"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono } from "@/components/grid/cells";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import { RECYCLE_BIN_DAYS } from "@/shared/constants";
import type { RecycleBinItem, RecycleBinResponse } from "@/shared/types";

export default function RecycleBinPage() {
  const { user, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [retentionDays, setRetentionDays] = useState(RECYCLE_BIN_DAYS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recycle-bin", { cache: "no-store" });
      if (res.ok) {
        const data: RecycleBinResponse = await res.json();
        setItems(data.items);
        setRetentionDays(data.retentionDays);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadItems();
  }, [user, loadItems]);

  const modules = useMemo(() => Array.from(new Set(items.map((i) => i.moduleLabel))).sort(), [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter(
      (i) =>
        (moduleFilter === "ALL" || i.moduleLabel === moduleFilter) &&
        (!q || `${i.code} ${i.title} ${i.moduleLabel} ${i.deletedByName ?? ""}`.toLowerCase().includes(q))
    );
  }, [items, search, moduleFilter]);

  const restore = async (row: RecycleBinItem | null) => {
    if (!row || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recycle-bin/${row.id}/restore`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Failed to restore", "error");
        return;
      }
      notify(`${row.code} restored to ${row.moduleLabel}`);
      for (const note of (data.notes as string[] | undefined) ?? []) notify(note, "error");
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setBusy(false);
    }
  };

  const purge = async (row: RecycleBinItem | null) => {
    if (!row || busy) return;
    const ok = window.confirm(
      `Delete ${row.code} permanently?\n\nIt can't be restored afterwards. Its Activity History, attachments and notes are deleted too.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recycle-bin/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Failed to delete", "error");
        return;
      }
      notify(`${row.code} deleted permanently`);
      await loadItems();
    } finally {
      setBusy(false);
    }
  };

  const columns: GridColumn<RecycleBinItem>[] = [
    { key: "moduleLabel", header: "Module", width: 140 },
    { key: "code", header: "Code", width: 150, render: (r) => <Mono>{r.code}</Mono> },
    { key: "title", header: "Title / Name", width: 280, wrap: true },
    { key: "includes", header: "Deleted With It", width: 170 },
    { key: "deletedByName", header: "Deleted By", width: 150 },
    { key: "deletedAt", header: "Deleted On", width: 160, value: (r) => r.deletedAt, render: (r) => formatDateTime(r.deletedAt) },
    { key: "purgeAt", header: "Removed On", width: 120, value: (r) => r.purgeAt, render: (r) => formatShortDate(r.purgeAt) },
  ];

  return (
    <AppShell>
      <GridPage>
        <div>
          <h1 className="text-[22px] font-bold text-[#2B3036]">Recycle Bin</h1>
          <p className="mt-1 text-[12.5px] text-[#6B7280]">
            Deleted records are kept for {retentionDays} days, then removed permanently. Restoring puts a record back with the same
            code, Activity History, attachments and notes.
          </p>
        </div>
        <DataGrid
          title="Deleted records"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          loading={loading}
          exportName="recycle-bin"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search code, title, module..."
          onRefresh={() => void loadItems()}
          emptyMessage="The Recycle Bin is empty."
          actions={[
            { label: "Restore", needsSelection: true, disabled: busy, onClick: (r) => void restore(r) },
            { label: "Delete Permanently", needsSelection: true, tone: "danger", disabled: busy, onClick: (r) => void purge(r) },
          ]}
          filters={
            <GridSelect
              label="Module"
              value={moduleFilter}
              onChange={setModuleFilter}
              options={["ALL", ...modules].map((m) => ({ value: m, label: m === "ALL" ? "All modules" : m }))}
            />
          }
          detail={(r) => (
            <DetailList
              items={[
                ["Module", r.moduleLabel],
                ["Code", r.code],
                ["Title / Name", r.title],
                ["Deleted with it", r.includes],
                ["Deleted by", r.deletedByName],
                ["Deleted on", formatDateTime(r.deletedAt)],
                ["Removed permanently on", formatShortDate(r.purgeAt)],
              ]}
            />
          )}
        />
      </GridPage>
    </AppShell>
  );
}
