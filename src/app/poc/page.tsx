"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { formatShortDate } from "@/lib/utils";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

const STAGES = ["Scoping", "Active Trial", "Evaluation", "Approved"] as const;
const OUTCOMES = ["Pending", "Success", "Extended", "Dropped"] as const;

interface PocRow {
  id: number;
  pocCode: string;
  title: string;
  description: string;
  status: string;
  outcome: string;
  successCriteria: string;
  evaluationScore: number;
  startDate: string | null;
  targetReviewDate: string | null;
  customerId: number | null;
  partnerId: number | null;
  productId: number | null;
  leadUserId: number | null;
  customerName: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  productName: string | null;
  assigneeName: string | null;
  assigneeJobTitle: string | null;
  assigneeAvatarColor: string | null;
  commentCount: number;
  attachmentCount: number;
}

export default function PocPage() {
  const { user, lookups, can } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<PocRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PocRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "Scoping",
    outcome: "Pending",
    successCriteria: "",
    evaluationScore: 50,
    startDate: "",
    targetReviewDate: "",
    customerId: "",
    partnerId: "",
    productId: "",
    leadUserId: "",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/poc", { cache: "no-store" });
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
        return `${i.pocCode} ${i.title} ${i.description} ${i.customerName ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        sortDir === "asc"
          ? a.evaluationScore - b.evaluationScore
          : b.evaluationScore - a.evaluationScore
      );
  }, [items, onlyMine, user, search, sortDir]);

  const approvedCount = items.filter(
    (i) => i.status === "Approved" || i.outcome === "Success"
  ).length;
  const winRate = items.length > 0 ? Math.round((approvedCount / items.length) * 100) : 0;

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      status: "Scoping",
      outcome: "Pending",
      successCriteria: "",
      evaluationScore: 50,
      startDate: new Date().toISOString().slice(0, 10),
      targetReviewDate: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
      customerId: lookups?.customers[0]?.id ? String(lookups.customers[0].id) : "",
      partnerId: "",
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
      outcome: found.outcome,
      successCriteria: found.successCriteria,
      evaluationScore: found.evaluationScore,
      startDate: found.startDate ? new Date(found.startDate).toISOString().slice(0, 10) : "",
      targetReviewDate: found.targetReviewDate
        ? new Date(found.targetReviewDate).toISOString().slice(0, 10)
        : "",
      customerId: found.customerId ? String(found.customerId) : "",
      partnerId: found.partnerId ? String(found.partnerId) : "",
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
        outcome: form.outcome,
        successCriteria: form.successCriteria,
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
        const err = await res.json();
        notify(err.error || "Failed to save POC", "error");
        return;
      }
      notify(editing ? "POC updated" : "POC registered");
      setModalOpen(false);
      await loadItems();
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (id: number, nextStage: string) => {
    const res = await fetch(`/api/poc/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStage }),
    });
    if (res.ok) {
      notify(`POC moved to ${nextStage}`);
      await loadItems();
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/poc/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("POC deleted");
      setModalOpen(false);
      await loadItems();
    }
  };

  const nextStage = (status: string) => {
    const idx = STAGES.indexOf(status as (typeof STAGES)[number]);
    return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  };

  const deleteRow = async (row: PocRow | null) => {
    if (!row || !window.confirm(`Delete ${row.pocCode}?`)) return;
    const res = await fetch(`/api/poc/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("POC deleted");
      await loadItems();
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const columns: GridColumn<PocRow>[] = [
    { key: "pocCode", header: "POC", width: 120, render: (r) => <Mono>{r.pocCode}</Mono> },
    { key: "customerName", header: "Customer", width: 170 },
    { key: "title", header: "Summary", width: 260, wrap: true },
    { key: "productName", header: "Product", width: 170 },
    { key: "status", header: "Stage", width: 120 },
    { key: "progress", header: "Progress", width: 100, value: (r) => STAGES.indexOf(r.status as (typeof STAGES)[number]), render: (r) => <SegmentProgress ratio={stageRatio(STAGES, r.status)} /> },
    { key: "evaluationScore", header: "Score", width: 80, align: "right", render: (r) => `${r.evaluationScore}%` },
    { key: "outcome", header: "Outcome", width: 110, render: (r) => <Pill tone={r.outcome === "Success" ? "normal" : r.outcome === "Dropped" ? "critical" : "low"}>{r.outcome}</Pill> },
    { key: "assigneeName", header: "Lead", width: 150, value: (r) => r.assigneeName ?? "Unassigned" },
    { key: "targetReviewDate", header: "Review Date", width: 110, value: (r) => r.targetReviewDate ?? "", render: (r) => formatShortDate(r.targetReviewDate) },
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
                ["Product", r.productName],
                ["Success Criteria", r.successCriteria],
                ["Lead", r.assigneeName ?? "Unassigned"],
                ["Description", r.description],
                ["Start Date", formatShortDate(r.startDate)],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "New Proof of Concept"}
        subtitle={editing?.pocCode}
        entityType="poc"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("delivery:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FieldLabel label="POC Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Trial Scope" required>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Success Criteria" required>
            <textarea
              rows={2}
              required
              value={form.successCriteria}
              onChange={(e) => setForm({ ...form, successCriteria: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Stage">
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
            <FieldLabel label="Outcome">
              <select
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                className={inputClass}
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Target Review Date">
              <input
                type="date"
                value={form.targetReviewDate}
                onChange={(e) => setForm({ ...form, targetReviewDate: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Product / Solution">
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Select —</option>
                {(lookups?.products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Lead Engineer">
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
          {can("delivery:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
