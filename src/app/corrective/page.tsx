"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatShortDate } from "@/lib/utils";

const STAGES = ["Reported", "Diagnosing", "In Repair", "Resolved"] as const;
const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;

interface CorrectiveRow {
  id: number;
  ticketCode: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  rootCause: string | null;
  resolutionNotes: string | null;
  dueDate: string | null;
  customerId: number | null;
  partnerId: number | null;
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

export default function CorrectivePage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<CorrectiveRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [sevFilter, setSevFilter] = useState("ALL");
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CorrectiveRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "High",
    status: "Reported",
    rootCause: "",
    resolutionNotes: "",
    dueDate: "",
    customerId: "",
    partnerId: "",
    serviceNumberId: "",
    productId: "",
    assigneeId: "",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/maintenance/corrective", { cache: "no-store" });
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
        if (sevFilter !== "ALL" && i.severity !== sevFilter) return false;
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return `${i.ticketCode} ${i.title} ${i.description} ${i.customerName ?? ""} ${i.serviceCode ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => (sortDir === "asc" ? a.id - b.id : b.id - a.id));
  }, [items, onlyMine, user, sevFilter, search, sortDir]);

  const openCount = items.filter((i) => i.status !== "Resolved").length;
  const resolvedCount = items.filter((i) => i.status === "Resolved").length;
  const criticalCount = items.filter((i) => i.severity === "Critical" && i.status !== "Resolved").length;
  const slaRate = items.length > 0 ? Math.round(((items.length - criticalCount) / items.length) * 100) : 100;

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      severity: "High",
      status: "Reported",
      rootCause: "",
      resolutionNotes: "",
      dueDate: new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10),
      customerId: lookups?.customers[0]?.id ? String(lookups.customers[0].id) : "",
      partnerId: "",
      serviceNumberId: lookups?.services[0]?.id ? String(lookups.services[0].id) : "",
      productId: lookups?.products[0]?.id ? String(lookups.products[0].id) : "",
      assigneeId: user ? String(user.id) : "",
    });
    setModalOpen(true);
  };

  // Support deep link from dashboard CTA: /corrective?new=1 opens the create form once.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || !lookups) return;
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      autoOpenedRef.current = true;
      openCreate();
      window.history.replaceState(null, "", "/corrective");
    }
  });

  const openEditById = (id: number) => {
    const found = items.find((i) => i.id === id);
    if (!found) return;
    setEditing(found);
    setForm({
      title: found.title,
      description: found.description,
      severity: found.severity,
      status: found.status,
      rootCause: found.rootCause ?? "",
      resolutionNotes: found.resolutionNotes ?? "",
      dueDate: found.dueDate ? new Date(found.dueDate).toISOString().slice(0, 10) : "",
      customerId: found.customerId ? String(found.customerId) : "",
      partnerId: found.partnerId ? String(found.partnerId) : "",
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
        severity: form.severity,
        status: form.status,
        rootCause: form.rootCause || null,
        resolutionNotes: form.resolutionNotes || null,
        dueDate: form.dueDate || null,
        customerId: form.customerId ? Number(form.customerId) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        serviceNumberId: form.serviceNumberId ? Number(form.serviceNumberId) : null,
        productId: form.productId ? Number(form.productId) : null,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      };
      const res = await fetch(
        editing ? `/api/maintenance/corrective/${editing.id}` : "/api/maintenance/corrective",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        notify(err.error || "Failed to save ticket", "error");
        return;
      }
      notify(editing ? "Corrective ticket updated" : "Corrective ticket created");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (id: number, nextStage: string) => {
    const res = await fetch(`/api/maintenance/corrective/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStage }),
    });
    if (res.ok) {
      notify(`Ticket moved to ${nextStage}`);
      await Promise.all([loadItems(), refreshLookups()]);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/maintenance/corrective/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Corrective ticket deleted");
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

  const deleteRow = async (row: CorrectiveRow | null) => {
    if (!row || !window.confirm(`Delete ${row.ticketCode}?`)) return;
    const res = await fetch(`/api/maintenance/corrective/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Corrective ticket deleted");
      await Promise.all([loadItems(), refreshLookups()]);
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const columns: GridColumn<CorrectiveRow>[] = [
    { key: "ticketCode", header: "Incident", width: 120, render: (r) => <Mono>{r.ticketCode}</Mono> },
    {
      key: "severity",
      header: "Priority",
      width: 100,
      value: (r) => SEVERITIES.indexOf(r.severity as (typeof SEVERITIES)[number]),
      render: (r) => <Pill tone={severityTone(r.severity)}>{r.severity}</Pill>,
    },
    { key: "customerName", header: "Customer", width: 170 },
    { key: "title", header: "Summary", width: 280, wrap: true },
    { key: "status", header: "Status", width: 110 },
    {
      key: "progress",
      header: "Progress",
      width: 100,
      value: (r) => STAGES.indexOf(r.status as (typeof STAGES)[number]),
      render: (r) => <SegmentProgress ratio={stageRatio(STAGES, r.status)} />,
    },
    { key: "serviceCode", header: "Service", width: 130 },
    { key: "assigneeName", header: "Owner", width: 150, value: (r) => r.assigneeName ?? "Unassigned" },
    { key: "dueDate", header: "SLA Due", width: 110, value: (r) => r.dueDate ?? "", render: (r) => formatShortDate(r.dueDate) },
    { key: "commentCount", header: "Notes", width: 70, align: "right" },
  ];

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
          searchPlaceholder="Search incident, customer, service..."
          onRefresh={() => void loadItems()}
          onOpen={(r) => openEditById(r.id)}
          rowTone={(r) => (r.severity === "Critical" && r.status !== "Resolved" ? "critical" : undefined)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !can("maintenance:write") },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEditById(r.id) },
            {
              label: "Advance",
              needsSelection: true,
              hidden: !can("maintenance:write"),
              onClick: (r) => {
                const n = r && nextStage(r.status);
                if (r && n) void handleMoveStage(r.id, n);
              },
            },
            {
              label: "Resolve",
              needsSelection: true,
              hidden: !can("maintenance:write"),
              onClick: (r) => r && r.status !== "Resolved" && void handleMoveStage(r.id, "Resolved"),
            },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("maintenance:delete"), onClick: (r) => void deleteRow(r) },
            { label: "My Items", active: onlyMine, onClick: () => setOnlyMine((m) => !m) },
          ]}
          filters={
            <GridSelect
              label="Severity"
              value={sevFilter}
              onChange={setSevFilter}
              options={[{ value: "ALL", label: "All severities" }, ...SEVERITIES.map((s) => ({ value: s, label: s }))]}
            />
          }
          detail={(r) => (
            <DetailList
              items={[
                ["Customer", r.customerName],
                ["Customer Email", r.customerEmail],
                ["Customer Address", r.customerAddress],
                ["Service Number", r.serviceCode],
                ["Description", r.description],
                ["Assigned Engineer", r.assigneeName ? `${r.assigneeName}${r.assigneeJobTitle ? ` · ${r.assigneeJobTitle}` : ""}` : "Unassigned"],
                ["Root Cause", r.rootCause],
                ["Resolution", r.resolutionNotes],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "Log Corrective Maintenance"}
        subtitle={editing?.ticketCode}
        entityType="corrective"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("maintenance:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FieldLabel label="Incident Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Symptom & Description" required>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Severity">
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className={inputClass}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
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
            <FieldLabel label="SLA Target Date">
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
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
            <FieldLabel label="Service Number">
              <select
                value={form.serviceNumberId}
                onChange={(e) => setForm({ ...form, serviceNumberId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Select service ID —</option>
                {(lookups?.services ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.serviceNumber} · {s.title}</option>
                ))}
              </select>
            </FieldLabel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Escalation Partner">
              <select
                value={form.partnerId}
                onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
                className={inputClass}
              >
                <option value="">— None —</option>
                {(lookups?.partners ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
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
          <FieldLabel label="Root Cause Analysis">
            <textarea
              rows={2}
              value={form.rootCause}
              onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
              className={inputClass}
              placeholder="Hardware fault, ISP degradation, config drift..."
            />
          </FieldLabel>
          <FieldLabel label="Resolution Notes">
            <textarea
              rows={2}
              value={form.resolutionNotes}
              onChange={(e) => setForm({ ...form, resolutionNotes: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          {can("maintenance:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
