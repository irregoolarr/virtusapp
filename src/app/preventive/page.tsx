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

const STAGES = ["Scheduled", "In Progress", "Verification", "Completed"] as const;
const FREQS = ["Monthly", "Quarterly", "Semi-Annual", "Annual"] as const;

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

interface PreventiveRow {
  id: number;
  planCode: string;
  title: string;
  description: string;
  frequency: string;
  status: string;
  scheduledDate: string;
  checklist: ChecklistItem[];
  customerId: number | null;
  serviceNumberId: number | null;
  productId: number | null;
  assigneeId: number | null;
  customerName: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  serviceCode: string | null;
  assigneeName: string | null;
  assigneeJobTitle: string | null;
  assigneeAvatarColor: string | null;
  commentCount: number;
  attachmentCount: number;
}

export default function PreventivePage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<PreventiveRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [freqFilter, setFreqFilter] = useState("ALL");
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PreventiveRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCheckLabel, setNewCheckLabel] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    frequency: "Quarterly",
    status: "Scheduled",
    scheduledDate: "",
    checklist: [] as ChecklistItem[],
    customerId: "",
    serviceNumberId: "",
    productId: "",
    assigneeId: "",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/maintenance/preventive", { cache: "no-store" });
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
        if (onlyMine && user && i.assigneeId !== user.id) return false;
        if (freqFilter !== "ALL" && i.frequency !== freqFilter) return false;
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return `${i.planCode} ${i.title} ${i.description} ${i.customerName ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        sortDir === "asc"
          ? new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
          : new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
      );
  }, [items, onlyMine, user, freqFilter, search, sortDir]);

  const completed = items.filter((i) => i.status === "Completed").length;
  const compliancePct = items.length > 0 ? Math.round((completed / items.length) * 100) : 100;

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      frequency: "Quarterly",
      status: "Scheduled",
      scheduledDate: new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10),
      checklist: [
        { id: "c1", label: "Verify backup & rollback readiness", done: false },
        { id: "c2", label: "Execute health inspection & capture metrics", done: false },
      ],
      customerId: lookups?.customers[0]?.id ? String(lookups.customers[0].id) : "",
      serviceNumberId: lookups?.services[0]?.id ? String(lookups.services[0].id) : "",
      productId: lookups?.products[0]?.id ? String(lookups.products[0].id) : "",
      assigneeId: user ? String(user.id) : "",
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
      frequency: found.frequency,
      status: found.status,
      scheduledDate: new Date(found.scheduledDate).toISOString().slice(0, 10),
      checklist: Array.isArray(found.checklist) ? found.checklist : [],
      customerId: found.customerId ? String(found.customerId) : "",
      serviceNumberId: found.serviceNumberId ? String(found.serviceNumberId) : "",
      productId: found.productId ? String(found.productId) : "",
      assigneeId: found.assigneeId ? String(found.assigneeId) : "",
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
        frequency: form.frequency,
        status: form.status,
        scheduledDate: form.scheduledDate,
        checklist: form.checklist,
        customerId: form.customerId ? Number(form.customerId) : null,
        serviceNumberId: form.serviceNumberId ? Number(form.serviceNumberId) : null,
        productId: form.productId ? Number(form.productId) : null,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      };
      const res = await fetch(
        editing ? `/api/maintenance/preventive/${editing.id}` : "/api/maintenance/preventive",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        notify(err.error || "Failed to save PM plan", "error");
        return;
      }
      notify(editing ? "Preventive plan updated" : "Preventive plan scheduled");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (id: number, nextStage: string) => {
    const res = await fetch(`/api/maintenance/preventive/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStage }),
    });
    if (res.ok) {
      notify(`PM plan moved to ${nextStage}`);
      await Promise.all([loadItems(), refreshLookups()]);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/maintenance/preventive/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("PM plan deleted");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const nextStage = (status: string) => {
    const idx = STAGES.indexOf(status as (typeof STAGES)[number]);
    return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  };

  const deleteRow = async (row: PreventiveRow | null) => {
    if (!row || !window.confirm(`Delete ${row.planCode}?`)) return;
    const res = await fetch(`/api/maintenance/preventive/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("PM plan deleted");
      await Promise.all([loadItems(), refreshLookups()]);
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const columns: GridColumn<PreventiveRow>[] = [
    { key: "planCode", header: "Plan", width: 120, render: (r) => <Mono>{r.planCode}</Mono> },
    { key: "frequency", header: "Frequency", width: 120, render: (r) => <Pill tone="low">{r.frequency}</Pill> },
    { key: "customerName", header: "Customer", width: 170 },
    { key: "title", header: "Summary", width: 280, wrap: true },
    { key: "status", header: "Status", width: 120 },
    { key: "progress", header: "Progress", width: 100, value: (r) => STAGES.indexOf(r.status as (typeof STAGES)[number]), render: (r) => <SegmentProgress ratio={stageRatio(STAGES, r.status)} /> },
    { key: "checks", header: "Checklist", width: 100, value: (r) => (r.checklist ?? []).filter((c) => c.done).length, render: (r) => `${(r.checklist ?? []).filter((c) => c.done).length}/${(r.checklist ?? []).length}` },
    { key: "serviceCode", header: "Service", width: 130 },
    { key: "assigneeName", header: "Owner", width: 150, value: (r) => r.assigneeName ?? "Unassigned" },
    { key: "scheduledDate", header: "Scheduled", width: 110, render: (r) => formatShortDate(r.scheduledDate) },
  ];

  return (
    <AppShell>
      <GridPage>
        <DataGrid
          title="Preventive Maintenance"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          exportName="preventive-maintenance"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search PM plan, customer..."
          onRefresh={() => void loadItems()}
          onOpen={(r) => openEdit(r)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !can("maintenance:write") },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            {
              label: "Advance",
              needsSelection: true,
              hidden: !can("maintenance:write"),
              onClick: (r) => {
                const n = r && nextStage(r.status);
                if (r && n) void handleMoveStage(r.id, n);
              },
            },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("maintenance:delete"), onClick: (r) => void deleteRow(r) },
            { label: "My Items", active: onlyMine, onClick: () => setOnlyMine((m) => !m) },
          ]}
          filters={
            <GridSelect
              label="Frequency"
              value={freqFilter}
              onChange={setFreqFilter}
              options={[{ value: "ALL", label: "All frequencies" }, ...FREQS.map((f) => ({ value: f, label: f }))]}
            />
          }
          detail={(r) => (
            <DetailList
              items={[
                ["Customer", r.customerName],
                ["Customer Email", r.customerEmail],
                ["Service Number", r.serviceCode],
                ["Assigned Engineer", r.assigneeName ?? "Unassigned"],
                ["Description", r.description],
                ["Open Checks", (r.checklist ?? []).filter((c) => !c.done).map((c) => c.label).join(", ") || "All checks complete"],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "Schedule Preventive Maintenance"}
        subtitle={editing?.planCode}
        entityType="preventive"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("maintenance:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FieldLabel label="Maintenance Plan Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Scope & Procedure" required>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Frequency">
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className={inputClass}
              >
                {FREQS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Status">
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
            <FieldLabel label="Scheduled Date" required>
              <input
                type="date"
                required
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
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
            <FieldLabel label="Assigned Engineer">
              <select
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Unassigned —</option>
                {(lookups?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </FieldLabel>
          </div>

          {/* Interactive Checklist */}
          <div className="space-y-2">
            <div className="text-[12px] font-medium text-[#4B5563]">Inspection Checklist</div>
            <div className="space-y-1.5">
              {form.checklist.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      checklist: form.checklist.map((item) =>
                        item.id === c.id ? { ...item, done: !item.done } : item
                      ),
                    })
                  }
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg border border-[#D9DEE3] hover:bg-[#F6F7F8] text-[12.5px]"
                >
                  {c.done ? (
                    <CheckSquare className="w-4 h-4 text-[#2B3036] shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-[#6B7280] shrink-0" />
                  )}
                  <span className={c.done ? "line-through text-[#6B7280]" : "text-[#2B3036]"}>
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCheckLabel}
                onChange={(e) => setNewCheckLabel(e.target.value)}
                placeholder="Add checklist step..."
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCheckLabel.trim()) return;
                  setForm({
                    ...form,
                    checklist: [
                      ...form.checklist,
                      { id: `chk-${Date.now()}`, label: newCheckLabel.trim(), done: false },
                    ],
                  });
                  setNewCheckLabel("");
                }}
                className="px-3 py-2 rounded-sm border border-[#C9D0D7] text-[12.5px] font-medium hover:bg-[#EEF1F4] shrink-0 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {can("maintenance:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
