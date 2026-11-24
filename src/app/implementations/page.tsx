"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, Plus, Square } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { formatShortDate } from "@/lib/utils";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { IMPLEMENTATION_STAGES } from "@/shared/constants";
import type { ImplementationItem, MilestoneItem } from "@/shared/types";

const STAGES = IMPLEMENTATION_STAGES;

type ImplementationRow = ImplementationItem;

export default function ImplementationsPage() {
  const { user, lookups, can } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<ImplementationRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImplementationRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "Kickoff",
    progressPct: 20,
    targetGoLive: "",
    blockers: "",
    milestones: [] as MilestoneItem[],
    customerId: "",
    partnerId: "",
    serviceNumberId: "",
    productId: "",
    leadUserId: "",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/implementations", { cache: "no-store" });
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
      .filter((i) => {
        if (onlyMine && user && i.leadUserId !== user.id) return false;
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return `${i.projectCode} ${i.title} ${i.description} ${i.customerName ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        sortDir === "asc" ? a.progressPct - b.progressPct : b.progressPct - a.progressPct
      );
  }, [items, onlyMine, user, search, sortDir]);

  const avgProgress =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.progressPct, 0) / items.length)
      : 0;
  const liveCount = items.filter((i) => i.status === "Go-Live").length;

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      status: "Kickoff",
      progressPct: 15,
      targetGoLive: new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10),
      blockers: "",
      milestones: [
        { id: "m1", title: "Architecture & kickoff sign-off", completed: true },
        { id: "m2", title: "Staging & cutover execution", completed: false },
      ],
      customerId: lookups?.customers[0]?.id ? String(lookups.customers[0].id) : "",
      partnerId: "",
      serviceNumberId: "",
      productId: lookups?.products[0]?.id ? String(lookups.products[0].id) : "",
      leadUserId: user ? String(user.id) : "",
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
      status: found.status,
      progressPct: found.progressPct,
      targetGoLive: found.targetGoLive
        ? new Date(found.targetGoLive).toISOString().slice(0, 10)
        : "",
      blockers: found.blockers ?? "",
      milestones: Array.isArray(found.milestones) ? found.milestones : [],
      customerId: found.customerId ? String(found.customerId) : "",
      partnerId: found.partnerId ? String(found.partnerId) : "",
      serviceNumberId: found.serviceNumberId ? String(found.serviceNumberId) : "",
      productId: found.productId ? String(found.productId) : "",
      leadUserId: found.leadUserId ? String(found.leadUserId) : "",
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
        status: form.status,
        progressPct: Number(form.progressPct),
        targetGoLive: form.targetGoLive || null,
        blockers: form.blockers || null,
        milestones: form.milestones,
        customerId: form.customerId ? Number(form.customerId) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        serviceNumberId: form.serviceNumberId ? Number(form.serviceNumberId) : null,
        productId: form.productId ? Number(form.productId) : null,
        leadUserId: form.leadUserId ? Number(form.leadUserId) : null,
      };
      const res = await fetch(
        editing ? `/api/implementations/${editing.id}` : "/api/implementations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        notify(err.error || "Failed to save implementation", "error");
        return;
      }
      notify(editing ? "Implementation updated" : "Implementation created");
      setModalOpen(false);
      await loadItems();
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (id: number, nextStage: string) => {
    const res = await fetch(`/api/implementations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStage }),
    });
    if (res.ok) {
      notify(`Implementation moved to ${nextStage}`);
      await loadItems();
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/implementations/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Implementation removed");
      setModalOpen(false);
      await loadItems();
    }
  };

  const nextStage = (status: string) => {
    const idx = STAGES.indexOf(status as (typeof STAGES)[number]);
    return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  };

  const deleteRow = async (row: ImplementationRow | null) => {
    if (!row || !window.confirm(`Delete ${row.projectCode}?`)) return;
    const res = await fetch(`/api/implementations/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Implementation removed");
      await loadItems();
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const columns: GridColumn<ImplementationRow>[] = [
    { key: "projectCode", header: "Project", width: 120, render: (r) => <Mono>{r.projectCode}</Mono> },
    { key: "customerName", header: "Customer", width: 170 },
    { key: "title", header: "Summary", width: 280, wrap: true },
    { key: "status", header: "Stage", width: 130 },
    { key: "progressPct", header: "Progress", width: 140, render: (r) => <span className="inline-flex items-center gap-2"><SegmentProgress ratio={r.progressPct / 100} /><span className="tabular-nums">{r.progressPct}%</span></span> },
    { key: "milestones", header: "Milestones", width: 110, value: (r) => (r.milestones ?? []).filter((m) => m.completed).length, render: (r) => `${(r.milestones ?? []).filter((m) => m.completed).length}/${(r.milestones ?? []).length}` },
    { key: "blockers", header: "Blocker", width: 200, render: (r) => r.blockers ? <span className="text-[#B42318]">{r.blockers}</span> : "" },
    { key: "assigneeName", header: "Lead", width: 150, value: (r) => r.assigneeName ?? "Unassigned" },
    { key: "targetGoLive", header: "Target Go-Live", width: 120, value: (r) => r.targetGoLive ?? "", render: (r) => formatShortDate(r.targetGoLive) },
  ];

  return (
    <AppShell>
      <GridPage>
        <DataGrid
          title="Implementation Status"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          exportName="implementations"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search project, customer..."
          onRefresh={() => void loadItems()}
          onOpen={(r) => openEdit(r)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !can("delivery:write") },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            {
              label: "Advance",
              needsSelection: true,
              hidden: !can("delivery:write"),
              onClick: (r) => {
                const n = r && nextStage(r.status);
                if (r && n) void handleMoveStage(r.id, n);
              },
            },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("delivery:delete"), onClick: (r) => void deleteRow(r) },
            { label: "My Items", active: onlyMine, onClick: () => setOnlyMine((m) => !m) },
          ]}
          detail={(r) => (
            <DetailList
              items={[
                ["Customer", r.customerName],
                ["Customer Email", r.customerEmail],
                ["Project Lead", r.assigneeName ?? "Unassigned"],
                ["Blockers", r.blockers],
                ["Description", r.description],
                ["Open Milestones", (r.milestones ?? []).filter((m) => !m.completed).map((m) => m.title).join(", ") || "All milestones complete"],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "New Implementation Rollout"}
        subtitle={editing?.projectCode}
        entityType="implementation"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("delivery:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FieldLabel label="Project Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Scope Description" required>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Phase">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClass}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Progress (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.progressPct}
                onChange={(e) => setForm({ ...form, progressPct: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Target Go-Live">
              <input
                type="date"
                value={form.targetGoLive}
                onChange={(e) => setForm({ ...form, targetGoLive: e.target.value })}
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
                <option value="">— Select —</option>
                {(lookups?.customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Implementation Lead">
              <select
                value={form.leadUserId}
                onChange={(e) => setForm({ ...form, leadUserId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Unassigned —</option>
                {(lookups?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </FieldLabel>
          </div>
          <FieldLabel label="Blockers / Dependencies">
            <input
              type="text"
              value={form.blockers}
              onChange={(e) => setForm({ ...form, blockers: e.target.value })}
              className={inputClass}
              placeholder="Hardware lead time, firewall approvals..."
            />
          </FieldLabel>

          {/* Milestones */}
          <div className="space-y-2">
            <div className="text-[12px] font-medium text-[#4B5563]">Rollout Milestones</div>
            {form.milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    milestones: form.milestones.map((item) =>
                      item.id === m.id ? { ...item, completed: !item.completed } : item
                    ),
                  })
                }
                className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg border border-[#D9DEE3] hover:bg-[#F6F7F8] text-[12.5px]"
              >
                {m.completed ? (
                  <CheckSquare className="w-4 h-4 text-[#2B3036]" />
                ) : (
                  <Square className="w-4 h-4 text-[#6B7280]" />
                )}
                <span className={m.completed ? "line-through text-[#6B7280]" : "text-[#2B3036]"}>
                  {m.title}
                </span>
              </button>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                placeholder="Add milestone..."
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newMilestone.trim()) return;
                  setForm({
                    ...form,
                    milestones: [
                      ...form.milestones,
                      { id: `ms-${Date.now()}`, title: newMilestone.trim(), completed: false },
                    ],
                  });
                  setNewMilestone("");
                }}
                className="px-3 py-2 rounded-sm border border-[#C9D0D7] text-[12.5px] font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {can("delivery:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
