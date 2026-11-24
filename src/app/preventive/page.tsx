"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, CheckSquare, Plus, RotateCcw, Square, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, stageRatio } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { Dialog, TextButton } from "@/components/Dialog";
import { ActivityHistory } from "@/components/records/ActivityHistory";
import { AttachmentsPanel, uploadAttachments } from "@/components/records/AttachmentsPanel";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import {
  PM_CATEGORIES,
  PM_CATEGORY_NAMES,
  PM_CHECKLIST_TEMPLATES,
  PM_DEFAULT_CHECKLIST,
  PM_FREQUENCIES,
  PREVENTIVE_STAGES,
} from "@/shared/constants";
import { nextVisitDate, pmScheduleInfo, type PmScheduleState } from "@/shared/pm";
import type { ChecklistItem, PreventiveItem } from "@/shared/types";

type PreventiveRow = PreventiveItem;

/** Stages chosen in the form; "Completed" goes through the Complete action. */
const WORK_STAGES = PREVENTIVE_STAGES.filter((s) => s !== "Completed");

const VIEWS = [
  { value: "open", label: "Open visits" },
  { value: "week", label: "Due in 7 days" },
  { value: "overdue", label: "Overdue" },
  { value: "Completed", label: "Completed" },
  { value: "all", label: "All visits" },
];

const SCHEDULE_TONE: Record<PmScheduleState, "critical" | "high" | "normal" | "low" | "done"> = {
  overdue: "critical",
  late: "critical",
  "due-today": "high",
  "due-soon": "high",
  upcoming: "normal",
  "on-time": "done",
};

function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Standard checklist for an item type. */
function templateChecklist(subcategory: string): ChecklistItem[] {
  const steps = PM_CHECKLIST_TEMPLATES[subcategory] ?? PM_DEFAULT_CHECKLIST;
  return steps.map((label, i) => ({ id: `chk-${Date.now()}-${i}`, label, done: false }));
}

function defaultVisitDate(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d);
}

const emptyForm = {
  title: "",
  description: "",
  frequency: "Quarterly",
  status: "Scheduled",
  category: "Other",
  subcategory: "General",
  scheduledDate: "",
  completionNotes: "",
  checklist: [] as ChecklistItem[],
  customerId: "",
  serviceNumberId: "",
  productId: "",
  assigneeId: "",
};

export default function PreventivePage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const canWrite = can("maintenance:write");

  const [items, setItems] = useState<PreventiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [freqFilter, setFreqFilter] = useState("ALL");
  const [view, setView] = useState("open");
  const [now, setNow] = useState(() => Date.now());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PreventiveRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [checklistTouched, setChecklistTouched] = useState(false);
  const [newCheckLabel, setNewCheckLabel] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [completing, setCompleting] = useState<PreventiveRow | null>(null);
  const [completion, setCompletion] = useState({ notes: "", scheduleNext: true, nextDate: "", notifyCustomer: false });
  const [reopening, setReopening] = useState<PreventiveRow | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/maintenance/preventive", { cache: "no-store" });
      if (res.ok) setItems((await res.json()).items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadItems();
  }, [user, loadItems]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const weekAhead = now + 7 * 86_400_000;
    return items
      .filter((p) => {
        if (freqFilter !== "ALL" && p.frequency !== freqFilter) return false;
        if (view === "open" && p.status === "Completed") return false;
        if (view === "Completed" && p.status !== "Completed") return false;
        if (view === "overdue" && pmScheduleInfo(p, now).state !== "overdue") return false;
        if (view === "week" && (p.status === "Completed" || new Date(p.scheduledDate).getTime() > weekAhead)) return false;
        if (!q) return true;
        return `${p.planCode} ${p.title} ${p.description} ${p.customerName ?? ""} ${p.serviceCode ?? ""} ${p.category} ${p.subcategory}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [items, freqFilter, view, search, now]);

  // ---- Form helpers --------------------------------------------------------------

  const servicesForCustomer = useMemo(() => {
    const all = lookups?.services ?? [];
    return form.customerId ? all.filter((s) => String(s.customerId) === form.customerId) : all;
  }, [lookups, form.customerId]);

  const setCustomer = (customerId: string) => {
    const keep = (lookups?.services ?? []).some((s) => String(s.id) === form.serviceNumberId && String(s.customerId) === customerId);
    setForm({ ...form, customerId, serviceNumberId: keep ? form.serviceNumberId : "" });
  };
  const setService = (serviceNumberId: string) => {
    const srv = (lookups?.services ?? []).find((s) => String(s.id) === serviceNumberId);
    setForm({ ...form, serviceNumberId, customerId: srv ? String(srv.customerId) : form.customerId });
  };

  /** Changing the item type on a new plan swaps in its standard checklist (until edited by hand). */
  const setType = (category: string, subcategory: string) => {
    const useTemplate = !editing && !checklistTouched;
    setForm({ ...form, category, subcategory, checklist: useTemplate ? templateChecklist(subcategory) : form.checklist });
  };

  const editChecklist = (checklist: ChecklistItem[]) => {
    setChecklistTouched(true);
    setForm({ ...form, checklist });
  };

  const openCreate = () => {
    setEditing(null);
    setPendingFiles([]);
    setChecklistTouched(false);
    setNewCheckLabel("");
    setForm({
      ...emptyForm,
      scheduledDate: defaultVisitDate(),
      checklist: templateChecklist(emptyForm.subcategory),
      assigneeId: user ? String(user.id) : "",
    });
    setModalOpen(true);
  };

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || !lookups) return;
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      autoOpenedRef.current = true;
      openCreate();
      window.history.replaceState(null, "", "/preventive");
    }
  });

  const openEdit = (row: PreventiveRow) => {
    setEditing(row);
    setChecklistTouched(true);
    setNewCheckLabel("");
    setForm({
      title: row.title,
      description: row.description,
      frequency: row.frequency,
      status: row.status,
      category: row.category,
      subcategory: row.subcategory,
      scheduledDate: toLocalInput(row.scheduledDate),
      completionNotes: row.completionNotes ?? "",
      checklist: Array.isArray(row.checklist) ? row.checklist : [],
      customerId: row.customerId ? String(row.customerId) : "",
      serviceNumberId: row.serviceNumberId ? String(row.serviceNumberId) : "",
      productId: row.productId ? String(row.productId) : "",
      assigneeId: row.assigneeId ? String(row.assigneeId) : "",
    });
    setModalOpen(true);
  };

  const refreshAll = () => Promise.all([loadItems(), refreshLookups()]);
  const completed = Boolean(editing && editing.status === "Completed");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        frequency: form.frequency,
        ...(!completed && { status: form.status }),
        category: form.category,
        subcategory: form.subcategory,
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : new Date().toISOString(),
        ...(completed && { completionNotes: form.completionNotes || null }),
        checklist: form.checklist,
        customerId: form.customerId ? Number(form.customerId) : null,
        serviceNumberId: form.serviceNumberId ? Number(form.serviceNumberId) : null,
        productId: form.productId ? Number(form.productId) : null,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      };
      const res = await fetch(editing ? `/api/maintenance/preventive/${editing.id}` : "/api/maintenance/preventive", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        notify((await res.json().catch(() => ({}))).error || "Failed to save PM plan", "error");
        return;
      }
      if (!editing && pendingFiles.length > 0) {
        const { item } = await res.json();
        const failed = await uploadAttachments("preventive", item.id, pendingFiles);
        if (failed.length) notify(`Plan created, but these files failed: ${failed.join(", ")}`, "error");
      }
      notify(editing ? "PM plan updated" : "PM visit scheduled");
      setPendingFiles([]);
      setModalOpen(false);
      await refreshAll();
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (row: PreventiveRow | null) => {
    if (!row || !window.confirm(`Delete ${row.planCode}? Its history and attachments are deleted too.`)) return;
    const res = await fetch(`/api/maintenance/preventive/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("PM plan deleted");
      setModalOpen(false);
      await refreshAll();
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  // ---- Lifecycle -----------------------------------------------------------------

  const openComplete = (row: PreventiveRow | null) => {
    if (!row) return;
    setCompletion({
      notes: row.completionNotes ?? "",
      scheduleNext: true,
      nextDate: toLocalInput(nextVisitDate(row.scheduledDate, row.frequency)),
      notifyCustomer: Boolean(row.customerEmail),
    });
    setCompleting(row);
  };

  const submitComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completing) return;
    setActionSaving(true);
    try {
      const res = await fetch(`/api/maintenance/preventive/${completing.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completionNotes: completion.notes,
          scheduleNext: completion.scheduleNext,
          nextScheduledDate: completion.scheduleNext && completion.nextDate ? new Date(completion.nextDate).toISOString() : null,
          notifyCustomer: completion.notifyCustomer && Boolean(completing.customerEmail),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Could not complete the visit", "error");
        return;
      }
      notify(data.next ? `${completing.planCode} completed · next visit ${data.next.planCode} scheduled` : `${completing.planCode} completed`);
      setCompleting(null);
      setModalOpen(false);
      await refreshAll();
    } finally {
      setActionSaving(false);
    }
  };

  const submitReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopening) return;
    setActionSaving(true);
    try {
      const res = await fetch(`/api/maintenance/preventive/${reopening.id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason }),
      });
      if (!res.ok) {
        notify((await res.json().catch(() => ({}))).error || "Could not reopen", "error");
        return;
      }
      notify(`${reopening.planCode} reopened`);
      setReopening(null);
      setModalOpen(false);
      await refreshAll();
    } finally {
      setActionSaving(false);
    }
  };

  // ---- Grid ----------------------------------------------------------------------

  const checksDone = (r: PreventiveRow) => (r.checklist ?? []).filter((c) => c.done).length;

  const columns: GridColumn<PreventiveRow>[] = [
    { key: "planCode", header: "Plan", width: 125, render: (r) => <Mono>{r.planCode}</Mono> },
    { key: "category", header: "Type", width: 190, value: (r) => `${r.category} / ${r.subcategory}` },
    { key: "title", header: "Summary", width: 250, wrap: true },
    { key: "customerName", header: "Customer", width: 160 },
    {
      key: "scheduledDate",
      header: "Scheduled",
      width: 170,
      value: (r) => r.scheduledDate,
      render: (r) => formatDateTime(r.scheduledDate),
    },
    {
      key: "schedule",
      header: "Schedule",
      width: 150,
      value: (r) => (r.status === "Completed" ? Number.MAX_SAFE_INTEGER : new Date(r.scheduledDate).getTime()),
      render: (r) => {
        const s = pmScheduleInfo(r, now);
        return (
          <Pill tone={SCHEDULE_TONE[s.state]} className="min-w-0">
            {s.label}
          </Pill>
        );
      },
    },
    { key: "status", header: "Status", width: 110 },
    { key: "checks", header: "Checklist", width: 95, value: checksDone, render: (r) => `${checksDone(r)}/${(r.checklist ?? []).length}` },
    { key: "frequency", header: "Frequency", width: 130, render: (r) => <Pill tone="low">{r.frequency}</Pill> },
    { key: "assigneeName", header: "Owner", width: 140, value: (r) => r.assigneeName ?? "Unassigned" },
    {
      key: "progress",
      header: "Progress",
      width: 100,
      value: (r) => PREVENTIVE_STAGES.indexOf(r.status as (typeof PREVENTIVE_STAGES)[number]),
      render: (r) => <SegmentProgress ratio={stageRatio(PREVENTIVE_STAGES, r.status)} />,
    },
  ];

  const completingOpen = completing ? completing.checklist.filter((c) => !c.done) : [];

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
          searchPlaceholder="Search plan, customer, type..."
          onRefresh={() => void loadItems()}
          loading={loading}
          emptyMessage={items.length === 0 ? "No preventive visits yet — click New to schedule the first one" : "No visits in this view"}
          onOpen={openEdit}
          rowTone={(r) => (pmScheduleInfo(r, now).state === "overdue" ? "critical" : undefined)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !canWrite },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            { label: "Complete", hidden: !canWrite, enabledFor: (r) => r.status !== "Completed", onClick: openComplete },
            {
              label: "Reopen",
              hidden: !canWrite,
              enabledFor: (r) => r.status === "Completed",
              onClick: (r) => {
                if (!r) return;
                setReopenReason("");
                setReopening(r);
              },
            },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("maintenance:delete"), onClick: (r) => void deletePlan(r) },
          ]}
          filters={
            <>
              <GridSelect label="View" value={view} onChange={setView} options={VIEWS} />
              <GridSelect
                label="Frequency"
                value={freqFilter}
                onChange={setFreqFilter}
                options={[{ value: "ALL", label: "All frequencies" }, ...PM_FREQUENCIES.map((f) => ({ value: f, label: f }))]}
              />
            </>
          }
          detail={(r) => (
            <DetailList
              items={[
                ["Customer", r.customerName],
                ["Customer Email", r.customerEmail],
                ["Type", `${r.category} / ${r.subcategory}`],
                ["Scheduled", `${formatDateTime(r.scheduledDate)} · ${pmScheduleInfo(r, now).label}`],
                ["Service Number", r.serviceCode],
                ["Assigned Engineer", r.assigneeName ?? "Unassigned"],
                ["Description", r.description],
                ["Open Checks", (r.checklist ?? []).filter((c) => !c.done).map((c) => c.label).join(", ") || "All checks complete"],
                ["Completion Report", r.completionNotes],
                ["Last Completed", r.lastCompletedAt ? formatDateTime(r.lastCompletedAt) : "—"],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "Schedule Preventive Maintenance"}
        subtitle={editing ? `${editing.planCode} · ${editing.status}` : undefined}
        entityType="preventive"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("maintenance:delete"))}
        onDelete={() => deletePlan(editing)}
        size="wide"
        placement="center"
        showComments={false}
      >
        {editing && canWrite && (
          <div className="flex flex-wrap gap-2" data-ignore-dirty>
            {!completed ? (
              <TextButton tone="primary" onClick={() => openComplete(editing)}>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4" /> Complete visit
                </span>
              </TextButton>
            ) : (
              <TextButton
                onClick={() => {
                  setReopenReason("");
                  setReopening(editing);
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" /> Reopen
                </span>
              </TextButton>
            )}
          </div>
        )}

        <form onSubmit={handleSave} data-record-form className="space-y-4">
          <FieldLabel label="Plan Title" required>
            <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="Scope & Description" required>
            <textarea rows={3} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </FieldLabel>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldLabel label="Category" required>
              <select
                value={form.category}
                onChange={(e) => setType(e.target.value, PM_CATEGORIES[e.target.value]?.[0] ?? "General")}
                className={inputClass}
              >
                {PM_CATEGORY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Item Type" required>
              <select value={form.subcategory} onChange={(e) => setType(form.category, e.target.value)} className={inputClass}>
                {(PM_CATEGORIES[form.category] ?? ["General"]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Frequency">
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={inputClass}>
                {PM_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldLabel label="Visit Date & Time" required>
              <input
                type="datetime-local"
                required
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Status">
              {completed ? (
                <input value={form.status} disabled className={`${inputClass} bg-[#F6F7F8]`} />
              ) : (
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                  {WORK_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </FieldLabel>
          </div>
          {!editing && (
            <p className="-mt-2 text-[12px] text-[#6B7280]">
              The engineer is emailed now and reminded 24 hours before the visit; managers are alerted if it is missed.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldLabel label="Customer">
              <select value={form.customerId} onChange={(e) => setCustomer(e.target.value)} className={inputClass}>
                <option value="">— Select customer —</option>
                {(lookups?.customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Service Number">
              <select value={form.serviceNumberId} onChange={(e) => setService(e.target.value)} className={inputClass}>
                <option value="">
                  {form.customerId && servicesForCustomer.length === 0 ? "— This customer has no services —" : "— Select service ID —"}
                </option>
                {servicesForCustomer.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.serviceNumber} · {s.title}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldLabel label="Product / Solution">
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className={inputClass}>
                <option value="">— None —</option>
                {(lookups?.products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Assigned Engineer">
              <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} className={inputClass}>
                <option value="">— Unassigned —</option>
                {(lookups?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          {/* Inspection checklist */}
          <section className="border border-[#D9DEE3]">
            <header className="flex items-center justify-between px-3 py-2 border-b border-[#D9DEE3] bg-[#F6F7F8]">
              <h3 className="text-[13px] font-semibold text-[#2B3036]">
                Inspection Checklist ({form.checklist.filter((c) => c.done).length}/{form.checklist.length})
              </h3>
              {!editing && <span className="text-[11.5px] text-[#6B7280]">Pre-filled for {form.subcategory} — edit as needed</span>}
            </header>
            <ul className="divide-y divide-[#E9ECEF]">
              {form.checklist.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => editChecklist(form.checklist.map((item) => (item.id === c.id ? { ...item, done: !item.done } : item)))}
                    aria-pressed={c.done}
                    className="flex flex-1 items-center gap-2.5 text-left text-[13px] py-0.5"
                  >
                    {c.done ? <CheckSquare className="w-4 h-4 text-[#1668AC] shrink-0" /> : <Square className="w-4 h-4 text-[#8A94A0] shrink-0" />}
                    <span className={c.done ? "line-through text-[#6B7280]" : "text-[#2B3036]"}>{c.label}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove step ${c.label}`}
                    onClick={() => editChecklist(form.checklist.filter((item) => item.id !== c.id))}
                    className="p-1 text-[#8A94A0] hover:text-[#B42318]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
              {form.checklist.length === 0 && <li className="px-3 py-2 text-[12.5px] text-[#6B7280]">No steps yet.</li>}
            </ul>
            <div className="flex gap-2 p-2 border-t border-[#E9ECEF]">
              <input
                type="text"
                value={newCheckLabel}
                onChange={(e) => setNewCheckLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!newCheckLabel.trim()) return;
                    editChecklist([...form.checklist, { id: `chk-${Date.now()}`, label: newCheckLabel.trim(), done: false }]);
                    setNewCheckLabel("");
                  }
                }}
                placeholder="Add a checklist step…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCheckLabel.trim()) return;
                  editChecklist([...form.checklist, { id: `chk-${Date.now()}`, label: newCheckLabel.trim(), done: false }]);
                  setNewCheckLabel("");
                }}
                className="px-3 rounded-sm border border-[#C9D0D7] text-[12.5px] font-medium hover:bg-[#EEF1F4] shrink-0 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </section>

          {completed && (
            <FieldLabel label="Completion Report" required>
              <textarea
                rows={3}
                required
                value={form.completionNotes}
                onChange={(e) => setForm({ ...form, completionNotes: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          )}

          <AttachmentsPanel
            entityType="preventive"
            entityId={editing?.id ?? null}
            canEdit={canWrite}
            pending={pendingFiles}
            onPendingChange={setPendingFiles}
          />
          {canWrite && <FormActions onCancel={() => setModalOpen(false)} saving={saving} />}
        </form>
        {editing && <ActivityHistory entityType="preventive" entityId={editing.id} canEdit={canWrite} />}
      </RecordModal>

      {/* Complete visit */}
      <Dialog open={Boolean(completing)} title={completing ? `Complete ${completing.planCode}` : "Complete"} onClose={() => setCompleting(null)}>
        <form onSubmit={submitComplete} className="space-y-3">
          {completing && <p className="text-[13px] text-[#4B5563]">{completing.title}</p>}
          {completingOpen.length > 0 && (
            <p className="text-[12.5px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-2">
              {completingOpen.length} checklist step(s) not ticked: {completingOpen.map((c) => c.label).join(", ")}. Explain in the report or tick them first.
            </p>
          )}
          <FieldLabel label="Findings & actions performed" required>
            <textarea
              rows={5}
              required
              minLength={5}
              maxLength={5000}
              value={completion.notes}
              onChange={(e) => setCompletion({ ...completion, notes: e.target.value })}
              placeholder="e.g. Battery self-test passed, load 42%, firmware updated to 3.1.2, no alarms in the last 90 days."
              className={inputClass}
            />
          </FieldLabel>
          <label className="flex items-start gap-2 text-[13px] text-[#2B3036]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={completion.scheduleNext}
              onChange={(e) => setCompletion({ ...completion, scheduleNext: e.target.checked })}
            />
            <span>Schedule the next {completing?.frequency.toLowerCase()} visit</span>
          </label>
          {completion.scheduleNext && (
            <FieldLabel label="Next visit">
              <input
                type="datetime-local"
                value={completion.nextDate}
                onChange={(e) => setCompletion({ ...completion, nextDate: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          )}
          <label className={`flex items-start gap-2 text-[13px] ${completing?.customerEmail ? "text-[#2B3036]" : "text-[#8A94A0]"}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              disabled={!completing?.customerEmail}
              checked={completion.notifyCustomer && Boolean(completing?.customerEmail)}
              onChange={(e) => setCompletion({ ...completion, notifyCustomer: e.target.checked })}
            />
            <span>
              Email the PM report to the customer
              {completing?.customerEmail ? ` (${completing.customerEmail})` : " — no customer contact email on this plan"}
            </span>
          </label>
          <div className="flex justify-end gap-1">
            <TextButton onClick={() => setCompleting(null)}>Cancel</TextButton>
            <TextButton type="submit" tone="primary" disabled={actionSaving || completion.notes.trim().length < 5}>
              {actionSaving ? "Completing..." : "Complete visit"}
            </TextButton>
          </div>
        </form>
      </Dialog>

      {/* Reopen */}
      <Dialog open={Boolean(reopening)} title={reopening ? `Reopen ${reopening.planCode}` : "Reopen"} onClose={() => setReopening(null)}>
        <form onSubmit={submitReopen} className="space-y-3">
          <p className="text-[13px] text-[#4B5563]">The visit goes back to In Progress and the engineer is notified.</p>
          <FieldLabel label="Reason" required>
            <textarea
              rows={4}
              required
              minLength={5}
              maxLength={2000}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. Backup test-restore was not performed."
              className={inputClass}
            />
          </FieldLabel>
          <div className="flex justify-end gap-1">
            <TextButton onClick={() => setReopening(null)}>Cancel</TextButton>
            <TextButton type="submit" tone="primary" disabled={actionSaving || reopenReason.trim().length < 5}>
              {actionSaving ? "Reopening..." : "Reopen"}
            </TextButton>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
