"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { Dialog, TextButton } from "@/components/Dialog";
import { ActivityHistory } from "@/components/records/ActivityHistory";
import { AttachmentsPanel, uploadAttachments } from "@/components/records/AttachmentsPanel";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import {
  CM_CATEGORIES,
  CM_CATEGORY_NAMES,
  CM_SOURCES,
  CORRECTIVE_STAGES,
  SEVERITIES,
  SLA_HOURS_BY_SEVERITY,
  isCorrectiveDone,
} from "@/shared/constants";
import { defaultSlaDue, slaInfo, type SlaState } from "@/shared/sla";
import type { CorrectiveItem } from "@/shared/types";
import { useOpenFromLink } from "@/components/useOpenFromLink";

type CorrectiveRow = CorrectiveItem;

/** Stages that can be chosen in the form; Resolved / Closed go through the actions. */
const WORK_STAGES = CORRECTIVE_STAGES.filter((s) => !isCorrectiveDone(s));

const VIEWS = [
  { value: "open", label: "Open tickets" },
  { value: "breached", label: "SLA breached" },
  { value: "Resolved", label: "Resolved" },
  { value: "Closed", label: "Closed" },
  { value: "all", label: "All tickets" },
];

const SLA_TONE: Record<SlaState, "critical" | "high" | "normal" | "low" | "done"> = {
  breached: "critical",
  missed: "critical",
  "at-risk": "high",
  "on-track": "normal",
  met: "done",
  none: "low",
};

/** ISO → value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = {
  title: "",
  description: "",
  severity: "High",
  status: "Reported",
  category: "Other",
  subcategory: "General",
  source: "Portal",
  rootCause: "",
  resolutionDetail: "",
  dueDate: "",
  customerId: "",
  partnerId: "",
  serviceNumberId: "",
  productId: "",
  assigneeId: "",
};

export default function CorrectivePage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const canWrite = can("maintenance:write");

  const [items, setItems] = useState<CorrectiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("ALL");
  const [view, setView] = useState("open");
  const [now, setNow] = useState(() => Date.now());

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CorrectiveRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [dueTouched, setDueTouched] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Lifecycle dialogs
  const [resolving, setResolving] = useState<CorrectiveRow | null>(null);
  const [resolution, setResolution] = useState({ detail: "", notifyCustomer: false });
  const [closing, setClosing] = useState<CorrectiveRow | null>(null);
  const [closeNote, setCloseNote] = useState("");
  const [reopening, setReopening] = useState<CorrectiveRow | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/maintenance/corrective", { cache: "no-store" });
      if (res.ok) setItems((await res.json()).items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadItems();
  }, [user, loadItems]);

  // SLA countdowns tick once a minute.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items
      .filter((i) => {
        if (sevFilter !== "ALL" && i.severity !== sevFilter) return false;
        if (view === "open" && isCorrectiveDone(i.status)) return false;
        if (view === "breached" && slaInfo(i, now).state !== "breached") return false;
        if ((view === "Resolved" || view === "Closed") && i.status !== view) return false;
        if (!q) return true;
        return `${i.ticketCode} ${i.title} ${i.description} ${i.customerName ?? ""} ${i.serviceCode ?? ""} ${i.category} ${i.subcategory}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.id - a.id);
  }, [items, sevFilter, view, search, now]);

  // ---- Form helpers --------------------------------------------------------------

  const servicesForCustomer = useMemo(() => {
    const all = lookups?.services ?? [];
    return form.customerId ? all.filter((s) => String(s.customerId) === form.customerId) : all;
  }, [lookups, form.customerId]);

  const setCustomer = (customerId: string) => {
    const keepService = (lookups?.services ?? []).some(
      (s) => String(s.id) === form.serviceNumberId && String(s.customerId) === customerId
    );
    setForm({ ...form, customerId, serviceNumberId: keepService ? form.serviceNumberId : "" });
  };

  const setService = (serviceNumberId: string) => {
    const srv = (lookups?.services ?? []).find((s) => String(s.id) === serviceNumberId);
    // Picking a service fills in its customer.
    setForm({ ...form, serviceNumberId, customerId: srv ? String(srv.customerId) : form.customerId });
  };

  const setSeverity = (severity: string) => {
    // New tickets follow the priority's default SLA until the date is edited by hand.
    const dueDate = !editing && !dueTouched ? toLocalInput(defaultSlaDue(severity)) : form.dueDate;
    setForm({ ...form, severity, dueDate });
  };

  const setCategory = (category: string) => setForm({ ...form, category, subcategory: CM_CATEGORIES[category]?.[0] ?? "General" });

  const openCreate = () => {
    setEditing(null);
    setPendingFiles([]);
    setDueTouched(false);
    setForm({ ...emptyForm, dueDate: toLocalInput(defaultSlaDue(emptyForm.severity)), assigneeId: user ? String(user.id) : "" });
    setModalOpen(true);
  };

  // Deep link from the dashboard: /corrective?new=1 opens the create form once.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || !lookups) return;
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      autoOpenedRef.current = true;
      openCreate();
      window.history.replaceState(null, "", "/corrective");
    }
  });

  const openEdit = (row: CorrectiveRow) => {
    setEditing(row);
    setDueTouched(true);
    setForm({
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      category: row.category,
      subcategory: row.subcategory,
      source: row.source,
      rootCause: row.rootCause ?? "",
      resolutionDetail: row.resolutionDetail ?? "",
      dueDate: toLocalInput(row.dueDate),
      customerId: row.customerId ? String(row.customerId) : "",
      partnerId: row.partnerId ? String(row.partnerId) : "",
      serviceNumberId: row.serviceNumberId ? String(row.serviceNumberId) : "",
      productId: row.productId ? String(row.productId) : "",
      assigneeId: row.assigneeId ? String(row.assigneeId) : "",
    });
    setModalOpen(true);
  };

  // Deep link from the notification bell: <page>?open=<id> opens that record.
  useOpenFromLink(items, openEdit);

  const refreshAll = () => Promise.all([loadItems(), refreshLookups()]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const done = Boolean(editing && isCorrectiveDone(editing.status));
      const payload = {
        title: form.title,
        description: form.description,
        severity: form.severity,
        // Lifecycle (resolve/close/reopen) goes through the actions, not the form.
        ...(!done && { status: form.status }),
        category: form.category,
        subcategory: form.subcategory,
        source: form.source,
        rootCause: form.rootCause || null,
        ...(done && { resolutionDetail: form.resolutionDetail || null }),
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        customerId: form.customerId ? Number(form.customerId) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        serviceNumberId: form.serviceNumberId ? Number(form.serviceNumberId) : null,
        productId: form.productId ? Number(form.productId) : null,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      };
      const res = await fetch(editing ? `/api/maintenance/corrective/${editing.id}` : "/api/maintenance/corrective", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        notify((await res.json().catch(() => ({}))).error || "Failed to save ticket", "error");
        return;
      }
      if (!editing && pendingFiles.length > 0) {
        const { item } = await res.json();
        const failed = await uploadAttachments("corrective", item.id, pendingFiles);
        if (failed.length) notify(`Ticket created, but these files failed: ${failed.join(", ")}`, "error");
      }
      notify(editing ? "Corrective ticket updated" : "Corrective ticket created");
      setPendingFiles([]);
      setModalOpen(false);
      await refreshAll();
    } finally {
      setSaving(false);
    }
  };

  const deleteTicket = async (row: CorrectiveRow | null) => {
    if (!row || !window.confirm(`Delete ${row.ticketCode}? Its history and attachments are deleted too.`)) return;
    const res = await fetch(`/api/maintenance/corrective/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Corrective ticket deleted");
      setModalOpen(false);
      await refreshAll();
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  // ---- Lifecycle actions -----------------------------------------------------------

  const runAction = async (row: CorrectiveRow, action: "resolve" | "close" | "reopen", body: unknown, done: string) => {
    setActionSaving(true);
    try {
      const res = await fetch(`/api/maintenance/corrective/${row.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || `Could not ${action} ticket`, "error");
        return false;
      }
      notify(`${row.ticketCode} ${done}`);
      setModalOpen(false);
      await refreshAll();
      return true;
    } finally {
      setActionSaving(false);
    }
  };

  const openResolve = (row: CorrectiveRow | null) => {
    if (!row) return;
    setResolution({ detail: row.resolutionDetail ?? "", notifyCustomer: Boolean(row.customerEmail) });
    setResolving(row);
  };
  const openClose = (row: CorrectiveRow | null) => {
    if (!row) return;
    setCloseNote("");
    setClosing(row);
  };
  const openReopen = (row: CorrectiveRow | null) => {
    if (!row) return;
    setReopenReason("");
    setReopening(row);
  };

  // ---- Grid ----------------------------------------------------------------------

  const columns: GridColumn<CorrectiveRow>[] = [
    { key: "ticketCode", header: "Incident", width: 125, render: (r) => <Mono>{r.ticketCode}</Mono> },
    {
      key: "severity",
      header: "Priority",
      width: 100,
      value: (r) => SEVERITIES.indexOf(r.severity as (typeof SEVERITIES)[number]),
      render: (r) => <Pill tone={severityTone(r.severity)}>{r.severity}</Pill>,
    },
    { key: "category", header: "Category", width: 190, value: (r) => `${r.category} / ${r.subcategory}` },
    { key: "customerName", header: "Customer", width: 160 },
    { key: "title", header: "Summary", width: 260, wrap: true },
    { key: "status", header: "Status", width: 105 },
    {
      key: "progress",
      header: "Progress",
      width: 100,
      value: (r) => CORRECTIVE_STAGES.indexOf(r.status as (typeof CORRECTIVE_STAGES)[number]),
      render: (r) => <SegmentProgress ratio={stageRatio(CORRECTIVE_STAGES, r.status)} />,
    },
    {
      key: "sla",
      header: "SLA",
      width: 185,
      // Sort by minutes left (breached first); finished tickets last.
      value: (r) => slaInfo(r, now).minutesLeft ?? Number.MAX_SAFE_INTEGER,
      render: (r) => {
        const sla = slaInfo(r, now);
        return (
          <Pill tone={SLA_TONE[sla.state]} className="min-w-0">
            <span title={r.dueDate ? `Target ${formatDateTime(r.dueDate)}` : undefined}>{sla.label}</span>
          </Pill>
        );
      },
    },
    { key: "source", header: "Source", width: 110 },
    { key: "assigneeName", header: "Owner", width: 140, value: (r) => r.assigneeName ?? "Unassigned" },
    { key: "createdAt", header: "Created On", width: 120, render: (r) => formatShortDate(r.createdAt) },
  ];

  const editingDone = Boolean(editing && isCorrectiveDone(editing.status));

  return (
    <AppShell>
      <GridPage>
        <DataGrid
          title="Corrective Maintenance"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          exportName="corrective-maintenance"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search incident, customer, category..."
          onRefresh={() => void loadItems()}
          loading={loading}
          emptyMessage={
            items.length === 0 ? "No corrective tickets yet — click New to log the first one" : "No tickets in this view"
          }
          onOpen={openEdit}
          rowTone={(r) =>
            (r.severity === "Critical" && !isCorrectiveDone(r.status)) || slaInfo(r, now).state === "breached" ? "critical" : undefined
          }
          actions={[
            { label: "New", onClick: openCreate, hidden: !canWrite },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            { label: "Resolve", hidden: !canWrite, enabledFor: (r) => !isCorrectiveDone(r.status), onClick: openResolve },
            { label: "Close", hidden: !canWrite, enabledFor: (r) => r.status === "Resolved", onClick: openClose },
            { label: "Reopen", hidden: !canWrite, enabledFor: (r) => isCorrectiveDone(r.status), onClick: openReopen },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("maintenance:delete"), onClick: (r) => void deleteTicket(r) },
          ]}
          filters={
            <>
              <GridSelect label="View" value={view} onChange={setView} options={VIEWS} />
              <GridSelect
                label="Severity"
                value={sevFilter}
                onChange={setSevFilter}
                options={[{ value: "ALL", label: "All priorities" }, ...SEVERITIES.map((s) => ({ value: s, label: s }))]}
              />
            </>
          }
          detail={(r) => {
            const sla = slaInfo(r, now);
            return (
              <DetailList
                items={[
                  ["Customer", r.customerName],
                  ["Customer Email", r.customerEmail],
                  ["Category", `${r.category} / ${r.subcategory}`],
                  ["Source", r.source],
                  ["SLA Target", r.dueDate ? `${formatDateTime(r.dueDate)} · ${sla.label}` : "No SLA"],
                  ["Service Number", r.serviceCode],
                  ["Assigned Engineer", r.assigneeName ? `${r.assigneeName}${r.assigneeJobTitle ? ` · ${r.assigneeJobTitle}` : ""}` : "Unassigned"],
                  ["Description", r.description],
                  ["Root Cause", r.rootCause],
                  ["Resolution", r.resolutionDetail],
                  ["Reopened", r.reopenCount ? `${r.reopenCount} time(s)` : "—"],
                ]}
              />
            );
          }}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "Log Corrective Maintenance"}
        subtitle={editing ? `${editing.ticketCode} · ${editing.status}` : undefined}
        entityType="corrective"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("maintenance:delete"))}
        onDelete={() => deleteTicket(editing)}
        size="wide"
        showComments={false}
      >
        {editing && canWrite && (
          <div className="flex flex-wrap gap-2" data-ignore-dirty>
            {!editingDone && (
              <TextButton tone="primary" onClick={() => openResolve(editing)}>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4" /> Resolve
                </span>
              </TextButton>
            )}
            {editing.status === "Resolved" && (
              <TextButton onClick={() => openClose(editing)}>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Close
                </span>
              </TextButton>
            )}
            {editingDone && (
              <TextButton onClick={() => openReopen(editing)}>
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" /> Reopen
                </span>
              </TextButton>
            )}
          </div>
        )}

        <form onSubmit={handleSave} data-record-form className="space-y-4">
          <FieldLabel label="Incident Title" required>
            <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="Symptom & Description" required>
            <textarea rows={3} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </FieldLabel>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldLabel label="Category" required>
              <select value={form.category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CM_CATEGORY_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Subcategory" required>
              <select value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} className={inputClass}>
                {(CM_CATEGORIES[form.category] ?? ["General"]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Source" required>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputClass}>
                {CM_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldLabel label="Priority">
              <select value={form.severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s} ({SLA_HOURS_BY_SEVERITY[s]}h SLA)
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Status">
              {editingDone ? (
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
            <FieldLabel label="SLA Target">
              <input
                type="datetime-local"
                value={form.dueDate}
                onChange={(e) => {
                  setDueTouched(true);
                  setForm({ ...form, dueDate: e.target.value });
                }}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          {!editing && (
            <p className="-mt-2 text-[12px] text-[#6B7280]">
              SLA target follows the priority (Critical 4h · High 8h · Medium 24h · Low 72h) unless you change it.
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
            <FieldLabel label="Escalation Partner">
              <select value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })} className={inputClass}>
                <option value="">— None —</option>
                {(lookups?.partners ?? []).map((p) => (
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
          <FieldLabel label="Root Cause Analysis">
            <textarea
              rows={2}
              value={form.rootCause}
              onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
              className={inputClass}
              placeholder="Hardware fault, ISP degradation, config drift..."
            />
          </FieldLabel>
          {editingDone && (
            <FieldLabel label="Resolution Detail" required>
              <textarea
                rows={3}
                required
                value={form.resolutionDetail}
                onChange={(e) => setForm({ ...form, resolutionDetail: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          )}
          <AttachmentsPanel
            entityType="corrective"
            entityId={editing?.id ?? null}
            canEdit={canWrite}
            pending={pendingFiles}
            onPendingChange={setPendingFiles}
          />
          {canWrite && <FormActions onCancel={() => setModalOpen(false)} saving={saving} />}
        </form>
        {editing && <ActivityHistory entityType="corrective" entityId={editing.id} canEdit={canWrite} />}
      </RecordModal>

      {/* Resolve: resolution detail (required) + optional customer email */}
      <Dialog open={Boolean(resolving)} title={resolving ? `Resolve ${resolving.ticketCode}` : "Resolve"} onClose={() => setResolving(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (resolving && (await runAction(resolving, "resolve", { resolutionDetail: resolution.detail, notifyCustomer: resolution.notifyCustomer }, "resolved")))
              setResolving(null);
          }}
          className="space-y-3"
        >
          {resolving && <p className="text-[13px] text-[#4B5563]">{resolving.title}</p>}
          <FieldLabel label="Resolution Detail" required>
            <textarea
              rows={5}
              required
              minLength={5}
              maxLength={5000}
              value={resolution.detail}
              onChange={(e) => setResolution({ ...resolution, detail: e.target.value })}
              placeholder="What was the fix? e.g. Replaced faulty SFP on core switch port Gi1/0/24, verified link stable for 30 minutes."
              className={inputClass}
            />
          </FieldLabel>
          <label className={`flex items-start gap-2 text-[13px] ${resolving?.customerEmail ? "text-[#2B3036]" : "text-[#8A94A0]"}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              disabled={!resolving?.customerEmail}
              checked={resolution.notifyCustomer && Boolean(resolving?.customerEmail)}
              onChange={(e) => setResolution({ ...resolution, notifyCustomer: e.target.checked })}
            />
            <span>
              Email the customer the resolution
              {resolving?.customerEmail ? ` (${resolving.customerEmail})` : " — no customer contact email on this ticket"}
            </span>
          </label>
          <p className="text-[12px] text-[#6B7280]">The assigned engineer is notified and everything is recorded in Activity History.</p>
          <div className="flex justify-end gap-1">
            <TextButton onClick={() => setResolving(null)}>Cancel</TextButton>
            <TextButton type="submit" tone="primary" disabled={actionSaving || resolution.detail.trim().length < 5}>
              {actionSaving ? "Resolving..." : "Resolve"}
            </TextButton>
          </div>
        </form>
      </Dialog>

      {/* Close: after the customer confirms */}
      <Dialog open={Boolean(closing)} title={closing ? `Close ${closing.ticketCode}` : "Close"} onClose={() => setClosing(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (closing && (await runAction(closing, "close", { note: closeNote }, "closed"))) setClosing(null);
          }}
          className="space-y-3"
        >
          <p className="text-[13px] text-[#4B5563]">Close the ticket once the customer has confirmed the fix. It can still be reopened later.</p>
          <FieldLabel label="Note (optional)">
            <textarea
              rows={3}
              maxLength={2000}
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="e.g. Customer confirmed by phone on 25 Nov."
              className={inputClass}
            />
          </FieldLabel>
          <div className="flex justify-end gap-1">
            <TextButton onClick={() => setClosing(null)}>Cancel</TextButton>
            <TextButton type="submit" tone="primary" disabled={actionSaving}>
              {actionSaving ? "Closing..." : "Close ticket"}
            </TextButton>
          </div>
        </form>
      </Dialog>

      {/* Reopen: reason required */}
      <Dialog open={Boolean(reopening)} title={reopening ? `Reopen ${reopening.ticketCode}` : "Reopen"} onClose={() => setReopening(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (reopening && (await runAction(reopening, "reopen", { reason: reopenReason }, "reopened"))) setReopening(null);
          }}
          className="space-y-3"
        >
          <p className="text-[13px] text-[#4B5563]">
            The ticket goes back to Diagnosing with a fresh SLA target, and the engineer is notified.
          </p>
          <FieldLabel label="Reason" required>
            <textarea
              rows={4}
              required
              minLength={5}
              maxLength={2000}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. Customer reports the link dropped again at 14:20."
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
