"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Gavel } from "lucide-react";
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
import { cn, formatDateTime, formatShortDate } from "@/lib/utils";
import { POC_DUE_SOON_DAYS, POC_STAGES, isPocFinished } from "@/shared/constants";
import { deadlineInfo, type DeadlineState } from "@/shared/deadline";
import type { PocItem } from "@/shared/types";

type Row = PocItem;

/** Stages chosen in the form; Approved comes from Decide → Success. */
const WORK_STAGES = POC_STAGES.filter((s) => s !== "Approved");

const VIEWS = [
  { value: "active", label: "Active POCs" },
  { value: "soon", label: `Review in ${POC_DUE_SOON_DAYS} days` },
  { value: "overdue", label: "Review overdue" },
  { value: "Success", label: "Approved" },
  { value: "Dropped", label: "Dropped" },
  { value: "all", label: "All POCs" },
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

const OUTCOME_TONE: Record<string, "normal" | "critical" | "high" | "low" | "done"> = {
  Success: "done",
  Dropped: "critical",
  Extended: "high",
  Pending: "low",
};

const DECISIONS = [
  { value: "Success", label: "Success — approve", help: "Criteria met. Moves to Approved." },
  { value: "Extended", label: "Extend trial", help: "Needs more time. Set a new review date." },
  { value: "Dropped", label: "Drop", help: "Not continuing. Closes the POC." },
] as const;

const toDateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");

const reviewInfo = (r: Row, now: number) =>
  deadlineInfo(
    {
      due: r.targetReviewDate,
      closedLabel: r.outcome === "Success" ? "Approved" : r.outcome === "Dropped" ? "Dropped" : null,
      soonDays: POC_DUE_SOON_DAYS,
      noun: "Review",
    },
    now
  );

const emptyForm = {
  title: "",
  description: "",
  successCriteria: "",
  status: "Scoping",
  evaluationScore: 0,
  startDate: "",
  targetReviewDate: "",
  customerId: "",
  partnerId: "",
  productId: "",
  leadUserId: "",
};

export default function PocPage() {
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [deciding, setDeciding] = useState<Row | null>(null);
  const [decision, setDecision] = useState({
    outcome: "Success" as "Success" | "Extended" | "Dropped",
    score: 0,
    notes: "",
    newReviewDate: "",
    notifyCustomer: false,
    createDeal: true,
    dealValue: 0,
  });
  const [actionSaving, setActionSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/poc", { cache: "no-store" });
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
        const finished = isPocFinished(r.outcome);
        const state = reviewInfo(r, now).state;
        if (view === "active" && finished) return false;
        if ((view === "Success" || view === "Dropped") && r.outcome !== view) return false;
        if (view === "overdue" && state !== "overdue") return false;
        if (view === "soon" && state !== "due-soon") return false;
        if (!q) return true;
        return `${r.pocCode} ${r.title} ${r.description} ${r.customerName ?? ""} ${r.productName ?? ""} ${r.successCriteria}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.targetReviewDate ?? "9999").localeCompare(b.targetReviewDate ?? "9999"));
  }, [items, view, search, now]);

  const openCreate = () => {
    setEditing(null);
    setPendingFiles([]);
    setForm({
      ...emptyForm,
      startDate: new Date().toISOString().slice(0, 10),
      targetReviewDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      leadUserId: user ? String(user.id) : "",
    });
    setModalOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      title: r.title,
      description: r.description,
      successCriteria: r.successCriteria,
      status: r.status,
      evaluationScore: r.evaluationScore,
      startDate: toDateInput(r.startDate),
      targetReviewDate: toDateInput(r.targetReviewDate),
      customerId: r.customerId ? String(r.customerId) : "",
      partnerId: r.partnerId ? String(r.partnerId) : "",
      productId: r.productId ? String(r.productId) : "",
      leadUserId: r.leadUserId ? String(r.leadUserId) : "",
    });
    setModalOpen(true);
  };

  const refreshAll = () => Promise.all([loadItems(), refreshLookups()]);
  const decided = Boolean(editing && isPocFinished(editing.outcome));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        successCriteria: form.successCriteria,
        ...(!decided && { status: form.status }),
        evaluationScore: Number(form.evaluationScore),
        startDate: form.startDate || null,
        targetReviewDate: form.targetReviewDate || null,
        customerId: form.customerId ? Number(form.customerId) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        productId: form.productId ? Number(form.productId) : null,
        leadUserId: form.leadUserId ? Number(form.leadUserId) : null,
      };
      const res = await fetch(editing ? `/api/poc/${editing.id}` : "/api/poc", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        notify((await res.json().catch(() => ({}))).error || "Failed to save POC", "error");
        return;
      }
      if (!editing && pendingFiles.length > 0) {
        const { item } = await res.json();
        const failed = await uploadAttachments("poc", item.id, pendingFiles);
        if (failed.length) notify(`POC created, but these files failed: ${failed.join(", ")}`, "error");
      }
      notify(editing ? "POC updated" : "POC created");
      setPendingFiles([]);
      setModalOpen(false);
      await refreshAll();
    } finally {
      setSaving(false);
    }
  };

  const deletePoc = async (r: Row | null) => {
    if (!r || !window.confirm(`Delete ${r.pocCode}? Its history and attachments are deleted too.`)) return;
    const res = await fetch(`/api/poc/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("POC deleted");
      setModalOpen(false);
      await refreshAll();
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const openDecide = (r: Row | null) => {
    if (!r) return;
    const nextReview = new Date(Math.max(Date.now(), new Date(r.targetReviewDate ?? Date.now()).getTime()) + 14 * 86_400_000);
    setDecision({
      outcome: "Success",
      score: r.evaluationScore,
      notes: r.decisionNotes ?? "",
      newReviewDate: nextReview.toISOString().slice(0, 10),
      notifyCustomer: Boolean(r.customerEmail),
      createDeal: true,
      dealValue: 0,
    });
    setDeciding(r);
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deciding) return;
    setActionSaving(true);
    try {
      const res = await fetch(`/api/poc/${deciding.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: decision.outcome,
          evaluationScore: Number(decision.score),
          decisionNotes: decision.notes,
          newReviewDate: decision.outcome === "Extended" ? decision.newReviewDate : null,
          notifyCustomer: decision.notifyCustomer && Boolean(deciding.customerEmail),
          createDeal: decision.outcome === "Success" && decision.createDeal,
          dealValueIdr: Number(decision.dealValue) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Could not record the decision", "error");
        return;
      }
      notify(
        decision.outcome === "Success"
          ? `${deciding.pocCode} approved${data.deal ? ` · pipeline deal ${data.deal.dealCode} created` : ""}`
          : decision.outcome === "Extended"
            ? `${deciding.pocCode} extended`
            : `${deciding.pocCode} dropped`
      );
      setDeciding(null);
      setModalOpen(false);
      await refreshAll();
    } finally {
      setActionSaving(false);
    }
  };

  // ---- Grid ------------------------------------------------------------------------

  const columns: GridColumn<Row>[] = [
    { key: "pocCode", header: "POC", width: 130, render: (r) => <Mono>{r.pocCode}</Mono> },
    { key: "title", header: "Summary", width: 250, wrap: true },
    { key: "customerName", header: "Customer", width: 160 },
    { key: "productName", header: "Product", width: 170 },
    { key: "targetReviewDate", header: "Review Date", width: 120, value: (r) => r.targetReviewDate ?? "", render: (r) => formatShortDate(r.targetReviewDate) },
    {
      key: "review",
      header: "Review",
      width: 195,
      value: (r) => (isPocFinished(r.outcome) ? Number.MAX_SAFE_INTEGER : r.targetReviewDate ? new Date(r.targetReviewDate).getTime() : Number.MAX_SAFE_INTEGER - 1),
      render: (r) => {
        const info = reviewInfo(r, now);
        return (
          <Pill tone={TONE[info.state]} className="min-w-0">
            {info.label}
          </Pill>
        );
      },
    },
    { key: "status", header: "Stage", width: 120 },
    {
      key: "progress",
      header: "Progress",
      width: 100,
      value: (r) => POC_STAGES.indexOf(r.status as (typeof POC_STAGES)[number]),
      render: (r) => <SegmentProgress ratio={stageRatio(POC_STAGES, r.status)} />,
    },
    { key: "evaluationScore", header: "Score", width: 80, align: "right", render: (r) => `${r.evaluationScore}%` },
    { key: "outcome", header: "Outcome", width: 110, render: (r) => <Pill tone={OUTCOME_TONE[r.outcome] ?? "low"}>{r.outcome}</Pill> },
    { key: "assigneeName", header: "Lead", width: 140, value: (r) => r.assigneeName ?? "Unassigned" },
  ];

  return (
    <AppShell>
      <GridPage>
        <DataGrid
          title="POC Status"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          exportName="poc-status"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search POC, customer, product..."
          onRefresh={() => void loadItems()}
          loading={loading}
          emptyMessage={items.length === 0 ? "No POCs yet — click New to start the first one" : "No POCs in this view"}
          onOpen={openEdit}
          rowTone={(r) => (reviewInfo(r, now).state === "overdue" ? "critical" : undefined)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !canWrite },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            { label: "Decide", hidden: !canWrite, enabledFor: (r) => !isPocFinished(r.outcome), onClick: openDecide },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("delivery:delete"), onClick: (r) => void deletePoc(r) },
          ]}
          filters={<GridSelect label="View" value={view} onChange={setView} options={VIEWS} />}
          detail={(r) => (
            <DetailList
              items={[
                ["Customer", r.customerName],
                ["Product", r.productName],
                ["Success Criteria", r.successCriteria],
                ["Review", `${formatShortDate(r.targetReviewDate)} · ${reviewInfo(r, now).label}`],
                ["Lead", r.assigneeName ?? "Unassigned"],
                ["Start Date", formatShortDate(r.startDate)],
                ["Description", r.description],
                ["Decision", r.decisionNotes ? `${r.outcome}: ${r.decisionNotes}` : "—"],
                ["Extended", r.extendedCount ? `${r.extendedCount} time(s)` : "—"],
                ["Decided On", r.decidedAt ? formatDateTime(r.decidedAt) : "—"],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "New Proof of Concept"}
        subtitle={editing ? `${editing.pocCode} · ${editing.status} · ${editing.outcome}` : undefined}
        entityType="poc"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("delivery:delete"))}
        onDelete={() => deletePoc(editing)}
        size="wide"
        showComments={false}
      >
        {editing && canWrite && !decided && (
          <div className="flex flex-wrap gap-2" data-ignore-dirty>
            <TextButton tone="primary" onClick={() => openDecide(editing)}>
              <span className="inline-flex items-center gap-1.5">
                <Gavel className="w-4 h-4" /> Decide
              </span>
            </TextButton>
          </div>
        )}

        <form onSubmit={handleSave} data-record-form className="space-y-4">
          <FieldLabel label="POC Title" required>
            <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="Trial Scope" required>
            <textarea rows={3} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="Success Criteria" required>
            <textarea
              rows={3}
              required
              value={form.successCriteria}
              onChange={(e) => setForm({ ...form, successCriteria: e.target.value })}
              placeholder="Measurable criteria, e.g. 99.9% uptime over 30 days, < 50 ms latency, 3 use cases signed off by the customer."
              className={inputClass}
            />
          </FieldLabel>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <FieldLabel label="Stage">
              {decided || editing?.status === "Approved" ? (
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
            <FieldLabel label="Eval Score (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.evaluationScore}
                onChange={(e) => setForm({ ...form, evaluationScore: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Start Date">
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputClass} />
            </FieldLabel>
            <FieldLabel label="Review Date">
              <input type="date" value={form.targetReviewDate} onChange={(e) => setForm({ ...form, targetReviewDate: e.target.value })} className={inputClass} />
            </FieldLabel>
          </div>
          {!editing && (
            <p className="-mt-2 text-[12px] text-[#6B7280]">
              The lead is reminded {POC_DUE_SOON_DAYS} days before the review; managers are alerted if no decision is made by then.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldLabel label="Customer">
              <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className={inputClass}>
                <option value="">— Select customer —</option>
                {(lookups?.customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <FieldLabel label="Lead Engineer">
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

          {editing?.decisionNotes && (
            <FieldLabel label={`Decision (${editing.outcome})`}>
              <textarea rows={3} value={editing.decisionNotes} disabled className={`${inputClass} bg-[#F6F7F8]`} />
            </FieldLabel>
          )}

          <AttachmentsPanel entityType="poc" entityId={editing?.id ?? null} canEdit={canWrite} pending={pendingFiles} onPendingChange={setPendingFiles} />
          {canWrite && <FormActions onCancel={() => setModalOpen(false)} saving={saving} />}
        </form>
        {editing && <ActivityHistory entityType="poc" entityId={editing.id} canEdit={canWrite} />}
      </RecordModal>

      <Dialog open={Boolean(deciding)} title={deciding ? `Decide ${deciding.pocCode}` : "Decide"} onClose={() => setDeciding(null)}>
        <form onSubmit={submitDecision} className="space-y-3">
          {deciding && (
            <div className="text-[12.5px] text-[#4B5563] bg-[#F6F7F8] border border-[#E9ECEF] px-3 py-2">
              <div className="font-medium text-[#2B3036]">{deciding.title}</div>
              <div className="mt-0.5">Criteria: {deciding.successCriteria}</div>
            </div>
          )}
          <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <legend className="sr-only">Decision</legend>
            {DECISIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "border px-3 py-2 cursor-pointer text-[12.5px]",
                  decision.outcome === opt.value ? "border-[#1668AC] bg-[#EDF2F6]" : "border-[#D9DEE3] hover:bg-[#F6F7F8]"
                )}
              >
                <input
                  type="radio"
                  name="decision"
                  value={opt.value}
                  checked={decision.outcome === opt.value}
                  onChange={() => setDecision({ ...decision, outcome: opt.value })}
                  className="sr-only"
                />
                <div className="font-semibold text-[#2B3036]">{opt.label}</div>
                <div className="text-[#6B7280]">{opt.help}</div>
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldLabel label="Evaluation score (%)">
              <input
                type="number"
                min={0}
                max={100}
                required
                value={decision.score}
                onChange={(e) => setDecision({ ...decision, score: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            {decision.outcome === "Extended" && (
              <FieldLabel label="New review date" required>
                <input
                  type="date"
                  required
                  value={decision.newReviewDate}
                  onChange={(e) => setDecision({ ...decision, newReviewDate: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
            )}
          </div>
          <FieldLabel label="Decision summary" required>
            <textarea
              rows={4}
              required
              minLength={5}
              maxLength={5000}
              value={decision.notes}
              onChange={(e) => setDecision({ ...decision, notes: e.target.value })}
              placeholder="Which criteria were met or missed, customer feedback, next steps."
              className={inputClass}
            />
          </FieldLabel>
          {decision.outcome === "Success" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <label className="flex items-start gap-2 text-[13px] text-[#2B3036]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={decision.createDeal}
                  onChange={(e) => setDecision({ ...decision, createDeal: e.target.checked })}
                />
                <span>Create a pipeline deal (Negotiation, 60%)</span>
              </label>
              {decision.createDeal && (
                <FieldLabel label="Deal value (IDR)">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={decision.dealValue}
                    onChange={(e) => setDecision({ ...decision, dealValue: Number(e.target.value) })}
                    className={inputClass}
                  />
                </FieldLabel>
              )}
            </div>
          )}
          <label className={`flex items-start gap-2 text-[13px] ${deciding?.customerEmail ? "text-[#2B3036]" : "text-[#8A94A0]"}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              disabled={!deciding?.customerEmail}
              checked={decision.notifyCustomer && Boolean(deciding?.customerEmail)}
              onChange={(e) => setDecision({ ...decision, notifyCustomer: e.target.checked })}
            />
            <span>
              Email the decision to the customer
              {deciding?.customerEmail ? ` (${deciding.customerEmail})` : " — no customer contact email on this POC"}
            </span>
          </label>
          <div className="flex justify-end gap-1">
            <TextButton onClick={() => setDeciding(null)}>Cancel</TextButton>
            <TextButton type="submit" tone="primary" disabled={actionSaving || decision.notes.trim().length < 5}>
              {actionSaving ? "Saving..." : "Record decision"}
            </TextButton>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
