"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, Plus, Rocket, Square, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { Dialog, TextButton } from "@/components/Dialog";
import { ActivityHistory } from "@/components/records/ActivityHistory";
import { AttachmentsPanel, uploadAttachments } from "@/components/records/AttachmentsPanel";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import { IMPLEMENTATION_STAGES, IMPLEMENTATION_TYPES, IMPL_DUE_SOON_DAYS } from "@/shared/constants";
import { deadlineInfo, type DeadlineState } from "@/shared/deadline";
import type { ImplementationItem, MilestoneItem } from "@/shared/types";

type Row = ImplementationItem;

/** Phases chosen in the form; Go-Live goes through the Go-Live action. */
const WORK_STAGES = IMPLEMENTATION_STAGES.filter((s) => s !== "Go-Live");

const VIEWS = [
  { value: "active", label: "Active projects" },
  { value: "soon", label: `Go-live in ${IMPL_DUE_SOON_DAYS} days` },
  { value: "late", label: "Late" },
  { value: "blocked", label: "Blocked" },
  { value: "live", label: "Live" },
  { value: "all", label: "All projects" },
];

const TONE: Record<DeadlineState, "critical" | "high" | "normal" | "low" | "done"> = {
  overdue: "critical",
  late: "critical",
  "due-soon": "high",
  upcoming: "normal",
  "on-time": "done",
  closed: "done",
  none: "low",
};

const DEFAULT_MILESTONES = ["Kickoff & design sign-off", "Configuration complete", "UAT passed", "Production cut-over", "Handover to support"];

const toDateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");

const goLiveInfo = (r: Row, now: number) =>
  deadlineInfo({ due: r.targetGoLive, doneAt: r.status === "Go-Live" ? r.goLiveAt ?? r.updatedAt : null, soonDays: IMPL_DUE_SOON_DAYS, noun: "Go-live" }, now);

const emptyForm = {
  title: "",
  description: "",
  status: "Kickoff",
  projectType: "Other",
  progressPct: 0,
  targetGoLive: "",
  blockers: "",
  handoverNotes: "",
  milestones: [] as MilestoneItem[],
  customerId: "",
  partnerId: "",
  serviceNumberId: "",
  productId: "",
  leadUserId: "",
};

export default function ImplementationsPage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const canWrite = can("delivery:write");

  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("active");
  const [now, setNow] = useState(() => Date.now());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [newMilestone, setNewMilestone] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [goingLive, setGoingLive] = useState<Row | null>(null);
  const [goLive, setGoLive] = useState({ notes: "", notifyCustomer: false });
  const [actionSaving, setActionSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/implementations", { cache: "no-store" });
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
    return items
      .filter((r) => {
        const live = r.status === "Go-Live";
        const state = goLiveInfo(r, now).state;
        if (view === "active" && live) return false;
        if (view === "live" && !live) return false;
        if (view === "late" && state !== "overdue") return false;
        if (view === "soon" && state !== "due-soon") return false;
        if (view === "blocked" && (live || !r.blockers)) return false;
        if (!q) return true;
        return `${r.projectCode} ${r.title} ${r.description} ${r.customerName ?? ""} ${r.projectType} ${r.blockers ?? ""}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.targetGoLive ?? "9999").localeCompare(b.targetGoLive ?? "9999"));
  }, [items, view, search, now]);

  // ---- Form ------------------------------------------------------------------------

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

  /** Ticking milestones moves the progress % along with them. */
  const setMilestones = (milestones: MilestoneItem[]) => {
    const done = milestones.filter((m) => m.completed).length;
    const progressPct = milestones.length ? Math.round((done / milestones.length) * 100) : form.progressPct;
    setForm({ ...form, milestones, progressPct: Math.min(progressPct, 95) });
  };

  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    setMilestones([...form.milestones, { id: `ms-${Date.now()}`, title: newMilestone.trim(), completed: false }]);
    setNewMilestone("");
  };

  const openCreate = () => {
    setEditing(null);
    setPendingFiles([]);
    setNewMilestone("");
    const target = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    setForm({
      ...emptyForm,
      targetGoLive: target,
      milestones: DEFAULT_MILESTONES.map((title, i) => ({ id: `ms-${Date.now()}-${i}`, title, completed: false })),
      leadUserId: user ? String(user.id) : "",
    });
    setModalOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setNewMilestone("");
    setForm({
      title: r.title,
      description: r.description,
      status: r.status,
      projectType: r.projectType,
      progressPct: r.progressPct,
      targetGoLive: toDateInput(r.targetGoLive),
      blockers: r.blockers ?? "",
      handoverNotes: r.handoverNotes ?? "",
      milestones: Array.isArray(r.milestones) ? r.milestones : [],
      customerId: r.customerId ? String(r.customerId) : "",
      partnerId: r.partnerId ? String(r.partnerId) : "",
      serviceNumberId: r.serviceNumberId ? String(r.serviceNumberId) : "",
      productId: r.productId ? String(r.productId) : "",
      leadUserId: r.leadUserId ? String(r.leadUserId) : "",
    });
    setModalOpen(true);
  };

  const refreshAll = () => Promise.all([loadItems(), refreshLookups()]);
  const live = Boolean(editing && editing.status === "Go-Live");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        ...(!live && { status: form.status, progressPct: Number(form.progressPct) }),
        projectType: form.projectType,
        targetGoLive: form.targetGoLive || null,
        blockers: form.blockers || null,
        milestones: form.milestones,
        customerId: form.customerId ? Number(form.customerId) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        serviceNumberId: form.serviceNumberId ? Number(form.serviceNumberId) : null,
        productId: form.productId ? Number(form.productId) : null,
        leadUserId: form.leadUserId ? Number(form.leadUserId) : null,
      };
      const res = await fetch(editing ? `/api/implementations/${editing.id}` : "/api/implementations", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        notify((await res.json().catch(() => ({}))).error || "Failed to save project", "error");
        return;
      }
      if (!editing && pendingFiles.length > 0) {
        const { item } = await res.json();
        const failed = await uploadAttachments("implementation", item.id, pendingFiles);
        if (failed.length) notify(`Project created, but these files failed: ${failed.join(", ")}`, "error");
      }
      notify(editing ? "Project updated" : "Implementation project created");
      setPendingFiles([]);
      setModalOpen(false);
      await refreshAll();
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (r: Row | null) => {
    if (!r || !window.confirm(`Delete ${r.projectCode}? Its history and attachments are deleted too.`)) return;
    const res = await fetch(`/api/implementations/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Project deleted");
      setModalOpen(false);
      await refreshAll();
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const openGoLive = (r: Row | null) => {
    if (!r) return;
    setGoLive({ notes: r.handoverNotes ?? "", notifyCustomer: Boolean(r.customerEmail) });
    setGoingLive(r);
  };

  const submitGoLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goingLive) return;
    setActionSaving(true);
    try {
      const res = await fetch(`/api/implementations/${goingLive.id}/go-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handoverNotes: goLive.notes, notifyCustomer: goLive.notifyCustomer && Boolean(goingLive.customerEmail) }),
      });
      if (!res.ok) {
        notify((await res.json().catch(() => ({}))).error || "Could not complete go-live", "error");
        return;
      }
      notify(`${goingLive.projectCode} is live`);
      setGoingLive(null);
      setModalOpen(false);
      await refreshAll();
    } finally {
      setActionSaving(false);
    }
  };

  // ---- Grid ------------------------------------------------------------------------

  const msDone = (r: Row) => (r.milestones ?? []).filter((m) => m.completed).length;

  const columns: GridColumn<Row>[] = [
    { key: "projectCode", header: "Project", width: 130, render: (r) => <Mono>{r.projectCode}</Mono> },
    { key: "projectType", header: "Type", width: 190 },
    { key: "title", header: "Summary", width: 250, wrap: true },
    { key: "customerName", header: "Customer", width: 160 },
    { key: "targetGoLive", header: "Target Go-Live", width: 130, value: (r) => r.targetGoLive ?? "", render: (r) => formatShortDate(r.targetGoLive) },
    {
      key: "golive",
      header: "Go-Live",
      width: 195,
      value: (r) => (r.status === "Go-Live" ? Number.MAX_SAFE_INTEGER : r.targetGoLive ? new Date(r.targetGoLive).getTime() : Number.MAX_SAFE_INTEGER - 1),
      render: (r) => {
        const info = goLiveInfo(r, now);
        return (
          <Pill tone={TONE[info.state]} className="min-w-0">
            {info.label}
          </Pill>
        );
      },
    },
    { key: "status", header: "Phase", width: 125 },
    {
      key: "progressPct",
      header: "Progress",
      width: 140,
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <SegmentProgress ratio={r.progressPct / 100} />
          <span className="tabular-nums">{r.progressPct}%</span>
        </span>
      ),
    },
    { key: "milestones", header: "Milestones", width: 105, value: msDone, render: (r) => `${msDone(r)}/${(r.milestones ?? []).length}` },
    { key: "blockers", header: "Blocker", width: 200, render: (r) => (r.blockers ? <span className="text-[#B42318]">{r.blockers}</span> : "") },
    { key: "assigneeName", header: "Lead", width: 140, value: (r) => r.assigneeName ?? "Unassigned" },
  ];

  const openMilestones = goingLive ? goingLive.milestones.filter((m) => !m.completed) : [];

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
          searchPlaceholder="Search project, customer, blocker..."
          onRefresh={() => void loadItems()}
          loading={loading}
          emptyMessage={items.length === 0 ? "No implementation projects yet — click New to create the first one" : "No projects in this view"}
          onOpen={openEdit}
          rowTone={(r) => (goLiveInfo(r, now).state === "overdue" || (r.blockers && r.status !== "Go-Live") ? "critical" : undefined)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !canWrite },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            { label: "Go-Live", hidden: !canWrite, enabledFor: (r) => r.status !== "Go-Live", onClick: openGoLive },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("delivery:delete"), onClick: (r) => void deleteProject(r) },
          ]}
          filters={<GridSelect label="View" value={view} onChange={setView} options={VIEWS} />}
          detail={(r) => (
            <DetailList
              items={[
                ["Customer", r.customerName],
                ["Type", r.projectType],
                ["Target Go-Live", `${formatShortDate(r.targetGoLive)} · ${goLiveInfo(r, now).label}`],
                ["Service Number", r.serviceCode],
                ["Project Lead", r.assigneeName ?? "Unassigned"],
                ["Blocker", r.blockers],
                ["Description", r.description],
                ["Open Milestones", (r.milestones ?? []).filter((m) => !m.completed).map((m) => m.title).join(", ") || "All milestones complete"],
                ["Handover", r.handoverNotes],
                ["Went Live", r.goLiveAt ? formatDateTime(r.goLiveAt) : "—"],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "New Implementation Project"}
        subtitle={editing ? `${editing.projectCode} · ${editing.status}` : undefined}
        entityType="implementation"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("delivery:delete"))}
        onDelete={() => deleteProject(editing)}
        size="wide"
        placement="center"
        showComments={false}
      >
        {editing && canWrite && !live && (
          <div className="flex flex-wrap gap-2" data-ignore-dirty>
            <TextButton tone="primary" onClick={() => openGoLive(editing)}>
              <span className="inline-flex items-center gap-1.5">
                <Rocket className="w-4 h-4" /> Go-Live
              </span>
            </TextButton>
          </div>
        )}

        <form onSubmit={handleSave} data-record-form className="space-y-4">
          <FieldLabel label="Project Title" required>
            <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="Scope Description" required>
            <textarea rows={3} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </FieldLabel>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <FieldLabel label="Project Type" required>
              <select value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value })} className={inputClass}>
                {IMPLEMENTATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Phase">
              {live ? (
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
            <FieldLabel label="Progress (%)">
              <input
                type="number"
                min={0}
                max={live ? 100 : 99}
                disabled={live}
                value={form.progressPct}
                onChange={(e) => setForm({ ...form, progressPct: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Target Go-Live">
              <input type="date" value={form.targetGoLive} onChange={(e) => setForm({ ...form, targetGoLive: e.target.value })} className={inputClass} />
            </FieldLabel>
          </div>
          {!editing && (
            <p className="-mt-2 text-[12px] text-[#6B7280]">
              The lead is reminded {IMPL_DUE_SOON_DAYS} days before the target go-live; managers are alerted if it slips.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <FieldLabel label="Partner">
              <select value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })} className={inputClass}>
                <option value="">— None —</option>
                {(lookups?.partners ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Project Lead">
              <select value={form.leadUserId} onChange={(e) => setForm({ ...form, leadUserId: e.target.value })} className={inputClass}>
                <option value="">— Unassigned —</option>
                {(lookups?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          {!live && (
            <FieldLabel label="Blocker / Dependency">
              <textarea
                rows={2}
                value={form.blockers}
                onChange={(e) => setForm({ ...form, blockers: e.target.value })}
                placeholder="Leave empty when nothing blocks the project. Saving a blocker emails the lead and managers."
                className={inputClass}
              />
            </FieldLabel>
          )}

          {/* Milestones */}
          <section className="border border-[#D9DEE3]">
            <header className="flex items-center justify-between px-3 py-2 border-b border-[#D9DEE3] bg-[#F6F7F8]">
              <h3 className="text-[13px] font-semibold text-[#2B3036]">
                Milestones ({form.milestones.filter((m) => m.completed).length}/{form.milestones.length})
              </h3>
              <span className="text-[11.5px] text-[#6B7280]">Ticking milestones updates progress</span>
            </header>
            <ul className="divide-y divide-[#E9ECEF]">
              {form.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2 px-3 py-1.5">
                  <button
                    type="button"
                    disabled={live}
                    aria-pressed={m.completed}
                    onClick={() => setMilestones(form.milestones.map((x) => (x.id === m.id ? { ...x, completed: !x.completed } : x)))}
                    className="flex flex-1 items-center gap-2.5 text-left text-[13px] py-0.5"
                  >
                    {m.completed ? <CheckSquare className="w-4 h-4 text-[#1668AC] shrink-0" /> : <Square className="w-4 h-4 text-[#8A94A0] shrink-0" />}
                    <span className={m.completed ? "line-through text-[#6B7280]" : "text-[#2B3036]"}>{m.title}</span>
                  </button>
                  {!live && (
                    <button
                      type="button"
                      aria-label={`Remove milestone ${m.title}`}
                      onClick={() => setMilestones(form.milestones.filter((x) => x.id !== m.id))}
                      className="p-1 text-[#8A94A0] hover:text-[#B42318]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {form.milestones.length === 0 && <li className="px-3 py-2 text-[12.5px] text-[#6B7280]">No milestones yet.</li>}
            </ul>
            {!live && (
              <div className="flex gap-2 p-2 border-t border-[#E9ECEF]">
                <input
                  type="text"
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMilestone();
                    }
                  }}
                  placeholder="Add a milestone…"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={addMilestone}
                  className="px-3 rounded-sm border border-[#C9D0D7] text-[12.5px] font-medium hover:bg-[#EEF1F4] shrink-0 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            )}
          </section>

          {live && (
            <FieldLabel label="Handover Notes">
              <textarea rows={3} value={form.handoverNotes} disabled className={`${inputClass} bg-[#F6F7F8]`} />
            </FieldLabel>
          )}

          <AttachmentsPanel
            entityType="implementation"
            entityId={editing?.id ?? null}
            canEdit={canWrite}
            pending={pendingFiles}
            onPendingChange={setPendingFiles}
          />
          {canWrite && <FormActions onCancel={() => setModalOpen(false)} saving={saving} />}
        </form>
        {editing && <ActivityHistory entityType="implementation" entityId={editing.id} canEdit={canWrite} />}
      </RecordModal>

      <Dialog open={Boolean(goingLive)} title={goingLive ? `Go-Live ${goingLive.projectCode}` : "Go-Live"} onClose={() => setGoingLive(null)}>
        <form onSubmit={submitGoLive} className="space-y-3">
          {goingLive && <p className="text-[13px] text-[#4B5563]">{goingLive.title}</p>}
          {(openMilestones.length > 0 || goingLive?.blockers) && (
            <p className="text-[12.5px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-2">
              {openMilestones.length > 0 && `${openMilestones.length} milestone(s) still open: ${openMilestones.map((m) => m.title).join(", ")}. `}
              {goingLive?.blockers && `Open blocker: ${goingLive.blockers}. `}
              Going live closes them — mention it in the handover.
            </p>
          )}
          <FieldLabel label="Handover notes" required>
            <textarea
              rows={5}
              required
              minLength={5}
              maxLength={5000}
              value={goLive.notes}
              onChange={(e) => setGoLive({ ...goLive, notes: e.target.value })}
              placeholder="e.g. Cut-over completed 22:00, monitoring added to NOC, documentation and credentials handed to support."
              className={inputClass}
            />
          </FieldLabel>
          <label className={`flex items-start gap-2 text-[13px] ${goingLive?.customerEmail ? "text-[#2B3036]" : "text-[#8A94A0]"}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              disabled={!goingLive?.customerEmail}
              checked={goLive.notifyCustomer && Boolean(goingLive?.customerEmail)}
              onChange={(e) => setGoLive({ ...goLive, notifyCustomer: e.target.checked })}
            />
            <span>
              Email the customer that the project is live
              {goingLive?.customerEmail ? ` (${goingLive.customerEmail})` : " — no customer contact email on this project"}
            </span>
          </label>
          <p className="text-[12px] text-[#6B7280]">Progress is set to 100% and the lead and managers are notified.</p>
          <div className="flex justify-end gap-1">
            <TextButton onClick={() => setGoingLive(null)}>Cancel</TextButton>
            <TextButton type="submit" tone="primary" disabled={actionSaving || goLive.notes.trim().length < 5}>
              {actionSaving ? "Going live..." : "Go-Live"}
            </TextButton>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
