"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import { formatShortDate } from "@/lib/utils";
import { CORRECTIVE_STAGES, SEVERITIES } from "@/shared/constants";
import type { CorrectiveItem } from "@/shared/types";

const STAGES = CORRECTIVE_STAGES;

type CorrectiveRow = CorrectiveItem;

export default function CorrectivePage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<CorrectiveRow[]>([]);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [resolving, setResolving] = useState<CorrectiveRow | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [resolveSaving, setResolveSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CorrectiveRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "High",
    status: "Reported",
    rootCause: "",
    resolutionDetail: "",
    dueDate: "",
    customerId: "",
    partnerId: "",
    serviceNumberId: "",
    productId: "",
    assigneeId: "",
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/maintenance/corrective", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadItems();
  }, [user, loadItems]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        if (sevFilter !== "ALL" && i.severity !== sevFilter) return false;
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return `${i.ticketCode} ${i.title} ${i.description} ${i.customerName ?? ""} ${i.serviceCode ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.id - a.id);
  }, [items, sevFilter, search]);

  const openCount = items.filter((i) => i.status !== "Resolved").length;
  const resolvedCount = items.filter((i) => i.status === "Resolved").length;
  const criticalCount = items.filter((i) => i.severity === "Critical" && i.status !== "Resolved").length;
  const slaRate = items.length > 0 ? Math.round(((items.length - criticalCount) / items.length) * 100) : 100;

  const openCreate = () => {
    setEditing(null);
    setPendingFiles([]);
    setForm({
      title: "",
      description: "",
      severity: "High",
      status: "Reported",
      rootCause: "",
      resolutionDetail: "",
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
      resolutionDetail: found.resolutionDetail ?? "",
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
        resolutionDetail: form.resolutionDetail || null,
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
      if (!editing && pendingFiles.length > 0) {
        const { item } = await res.json();
        const failed = await uploadAttachments("corrective", item.id, pendingFiles);
        if (failed.length) notify(`Ticket created, but these files failed to upload: ${failed.join(", ")}`, "error");
      }
      notify(editing ? "Corrective ticket updated" : "Corrective ticket created");
      setPendingFiles([]);
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const openResolve = (row: CorrectiveRow | null) => {
    if (!row || row.status === "Resolved") return;
    setResolutionText(row.resolutionDetail ?? "");
    setResolving(row);
  };

  const submitResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolving || !resolutionText.trim()) return;
    setResolveSaving(true);
    try {
      const res = await fetch(`/api/maintenance/corrective/${resolving.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Resolved", resolutionDetail: resolutionText.trim() }),
      });
      if (!res.ok) {
        notify((await res.json().catch(() => ({}))).error || "Could not resolve ticket", "error");
        return;
      }
      notify(`${resolving.ticketCode} resolved`);
      setResolving(null);
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setResolveSaving(false);
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
    { key: "createdAt", header: "Created On", width: 120, render: (r) => formatShortDate(r.createdAt) },
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
          loading={loading}
          emptyMessage={search || sevFilter !== "ALL" ? "No tickets match your filters" : "No corrective tickets yet — click New to log the first one"}
          onOpen={(r) => openEditById(r.id)}
          rowTone={(r) => (r.severity === "Critical" && r.status !== "Resolved" ? "critical" : undefined)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !can("maintenance:write") },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEditById(r.id) },
            {
              label: "Resolve",
              needsSelection: true,
              hidden: !can("maintenance:write"),
              onClick: (r) => openResolve(r),
            },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("maintenance:delete"), onClick: (r) => void deleteRow(r) },
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
                ["Resolution", r.resolutionDetail],
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
        size="wide"
        showComments={false}
      >
        <form onSubmit={handleSave} data-record-form className="space-y-4">
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
          <FieldLabel label="Resolution Detail" required={form.status === "Resolved"}>
            <textarea
              rows={2}
              required={form.status === "Resolved"}
              placeholder={form.status === "Resolved" ? "Required to resolve: what was done to fix it?" : "Filled in when the ticket is resolved"}
              value={form.resolutionDetail}
              onChange={(e) => setForm({ ...form, resolutionDetail: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <AttachmentsPanel
            entityType="corrective"
            entityId={editing?.id ?? null}
            canEdit={can("maintenance:write")}
            pending={pendingFiles}
            onPendingChange={setPendingFiles}
          />
          {can("maintenance:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
        {editing && <ActivityHistory entityType="corrective" entityId={editing.id} canEdit={can("maintenance:write")} />}
      </RecordModal>

      <Dialog open={Boolean(resolving)} title={resolving ? `Resolve ${resolving.ticketCode}` : "Resolve"} onClose={() => setResolving(null)}>
        <form onSubmit={submitResolve} className="space-y-3">
          {resolving && <p className="text-[13px] text-[#4B5563]">{resolving.title}</p>}
          <FieldLabel label="Resolution Detail" required>
            <textarea
              rows={5}
              required
              maxLength={5000}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="What was the fix? e.g. Replaced faulty SFP on core switch port Gi1/0/24, verified link stable for 30 minutes."
              className={inputClass}
            />
          </FieldLabel>
          <p className="text-[12px] text-[#6B7280]">The assigned engineer is emailed and the resolution is recorded in Activity History.</p>
          <div className="flex justify-end gap-1">
            <TextButton onClick={() => setResolving(null)}>Cancel</TextButton>
            <TextButton type="submit" tone="primary" disabled={resolveSaving || !resolutionText.trim()}>
              {resolveSaving ? "Resolving..." : "Resolve"}
            </TextButton>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
