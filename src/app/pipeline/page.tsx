"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/shared/constants";
import type { PipelineItem } from "@/shared/types";

const STAGES = PIPELINE_STAGES;

type PipelineDealRow = PipelineItem;

export default function PipelinePage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<PipelineDealRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState("ALL");
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PipelineDealRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    stage: "Contacted",
    dealValueUsd: 3500,
    probabilityPct: 35,
    expectedCloseDate: "",
    customerId: "",
    partnerId: "",
    productId: "",
    ownerId: "",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/pipeline", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }, []);

  useEffect(() => {
    if (user) void loadItems();
  }, [user, loadItems]);

  const filtered = useMemo(() => {
    return items
      .filter((item) => {
        if (onlyMine && user && item.ownerId !== user.id) return false;
        if (stageFilter !== "ALL" && item.stage !== stageFilter) return false;
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return `${item.dealCode} ${item.title} ${item.description} ${item.customerName ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        sortDir === "asc" ? a.dealValueUsd - b.dealValueUsd : b.dealValueUsd - a.dealValueUsd
      );
  }, [items, onlyMine, user, stageFilter, search, sortDir]);

  const closedValue = items
    .filter((i) => i.stage === "Deal Closed")
    .reduce((sum, i) => sum + i.dealValueUsd, 0);
  const activeCount = items.filter((i) => i.stage !== "Deal Closed").length;
  const winPct =
    items.length > 0
      ? Math.round((items.filter((i) => i.stage === "Deal Closed").length / items.length) * 100)
      : 0;

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      stage: "Contacted",
      dealValueUsd: 3500,
      probabilityPct: 35,
      expectedCloseDate: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
      customerId: lookups?.customers[0]?.id ? String(lookups.customers[0].id) : "",
      partnerId: "",
      productId: lookups?.products[0]?.id ? String(lookups.products[0].id) : "",
      ownerId: user ? String(user.id) : "",
    });
    setModalOpen(true);
  };

  const openEdit = (card: { id: number }) => {
    const found = items.find((i) => i.id === card.id);
    if (!found) return;
    setEditing(found);
    setForm({
      title: found.title,
      description: found.description,
      stage: found.stage,
      dealValueUsd: found.dealValueUsd,
      probabilityPct: found.probabilityPct,
      expectedCloseDate: found.expectedCloseDate
        ? new Date(found.expectedCloseDate).toISOString().slice(0, 10)
        : "",
      customerId: found.customerId ? String(found.customerId) : "",
      partnerId: found.partnerId ? String(found.partnerId) : "",
      productId: found.productId ? String(found.productId) : "",
      ownerId: found.ownerId ? String(found.ownerId) : "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        stage: form.stage,
        dealValueUsd: Number(form.dealValueUsd),
        probabilityPct: Number(form.probabilityPct),
        expectedCloseDate: form.expectedCloseDate || null,
        customerId: form.customerId ? Number(form.customerId) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        productId: form.productId ? Number(form.productId) : null,
        ownerId: form.ownerId ? Number(form.ownerId) : null,
      };
      const url = editing ? `/api/pipeline/${editing.id}` : "/api/pipeline";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        notify(err.error || "Failed to save deal", "error");
        return;
      }
      notify(editing ? "Pipeline deal updated" : "Pipeline deal created");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (id: number, nextStage: string) => {
    const res = await fetch(`/api/pipeline/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: nextStage }),
    });
    if (res.ok) {
      notify(`Moved deal to ${nextStage}`);
      await Promise.all([loadItems(), refreshLookups()]);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/pipeline/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Deal removed");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } else {
      notify("Insufficient permission to delete", "error");
    }
  };

  const nextStage = (status: string) => {
    const idx = STAGES.indexOf(status as (typeof STAGES)[number]);
    return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  };

  const deleteRow = async (row: PipelineDealRow | null) => {
    if (!row || !window.confirm(`Delete ${row.dealCode}?`)) return;
    const res = await fetch(`/api/pipeline/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Deal deleted");
      await loadItems();
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const columns: GridColumn<PipelineDealRow>[] = [
    { key: "dealCode", header: "Deal", width: 120, render: (r) => <Mono>{r.dealCode}</Mono> },
    { key: "customerName", header: "Customer", width: 170 },
    { key: "title", header: "Summary", width: 260, wrap: true },
    { key: "stage", header: "Stage", width: 120 },
    { key: "progress", header: "Progress", width: 100, value: (r) => STAGES.indexOf(r.stage as (typeof STAGES)[number]), render: (r) => <SegmentProgress ratio={stageRatio(STAGES, r.stage)} /> },
    { key: "dealValueUsd", header: "Value", width: 120, align: "right", render: (r) => formatCurrency(r.dealValueUsd) },
    { key: "probabilityPct", header: "Win %", width: 80, align: "right", render: (r) => `${r.probabilityPct}%` },
    { key: "assigneeName", header: "Owner", width: 150, value: (r) => r.assigneeName ?? "Unassigned" },
    { key: "expectedCloseDate", header: "Expected Close", width: 120, value: (r) => r.expectedCloseDate ?? "", render: (r) => formatShortDate(r.expectedCloseDate) },
  ];

  return (
    <AppShell>
      <GridPage>
        <DataGrid
          title="Pipeline"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          exportName="pipeline"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search deal or customer..."
          onRefresh={() => void loadItems()}
          onOpen={(r) => openEdit(r)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !can("pipeline:write") },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            {
              label: "Advance",
              needsSelection: true,
              hidden: !can("pipeline:write"),
              onClick: (r) => {
                const n = r && nextStage(r.stage);
                if (r && n) void handleMoveStage(r.id, n);
              },
            },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("pipeline:delete"), onClick: (r) => void deleteRow(r) },
            { label: "My Items", active: onlyMine, onClick: () => setOnlyMine((m) => !m) },
          ]}
          filters={
            <GridSelect
              label="Stage"
              value={stageFilter}
              onChange={setStageFilter}
              options={[{ value: "ALL", label: "All stages" }, ...STAGES.map((s) => ({ value: s, label: s }))]}
            />
          }
          detail={(r) => (
            <DetailList
              items={[
                ["Customer", r.customerName],
                ["Customer Email", r.customerEmail],
                ["Owner", r.assigneeName ?? "Unassigned"],
                ["Weighted Value", formatCurrency(Math.round((r.dealValueUsd * r.probabilityPct) / 100))],
                ["Description", r.description],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "New Pipeline Deal"}
        subtitle={editing?.dealCode}
        entityType="pipeline"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("pipeline:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FieldLabel label="Deal / Account Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              placeholder="e.g. Prime Estate Tower-B Managed SD-WAN"
            />
          </FieldLabel>
          <FieldLabel label="Scope Description" required>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Stage">
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className={inputClass}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Expected Close Date">
              <input
                type="date"
                value={form.expectedCloseDate}
                onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Deal Value (USD)">
              <input
                type="number"
                min={0}
                value={form.dealValueUsd}
                onChange={(e) => setForm({ ...form, dealValueUsd: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Win Probability (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.probabilityPct}
                onChange={(e) => setForm({ ...form, probabilityPct: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Customer">
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Select customer —</option>
                {(lookups?.customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Product / Solution">
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Select product —</option>
                {(lookups?.products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FieldLabel>
          </div>
          <FieldLabel label="Account Owner">
            <select
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              className={inputClass}
            >
              <option value="">— Unassigned —</option>
              {(lookups?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.jobTitle})</option>
              ))}
            </select>
          </FieldLabel>
          {can("pipeline:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
