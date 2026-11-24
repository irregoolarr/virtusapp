"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
import { KanbanBoard, KanbanCardItem } from "@/components/KanbanBoard";
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
  const [view, setView] = useState<"board" | "table">("board");
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

  const cards: KanbanCardItem[] = filtered.map((c) => ({
    id: c.id,
    code: c.ticketCode,
    title: c.title,
    description: c.description,
    stage: c.status,
    date: c.dueDate,
    customerName: c.customerName,
    customerAddress: c.customerAddress,
    customerEmail: c.customerEmail,
    extraLine: c.serviceCode ? `Service: ${c.serviceCode}` : null,
    assigneeName: c.assigneeName,
    assigneeJobTitle: c.assigneeJobTitle,
    assigneeAvatarColor: c.assigneeAvatarColor,
    commentCount: c.commentCount,
    attachmentCount: c.attachmentCount,
    badgeText: c.severity,
    badgeTone:
      c.severity === "Critical"
        ? "critical"
        : c.severity === "High"
          ? "warning"
          : "neutral",
  }));

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search CM code, incident, customer, service ID..."
        sortDir={sortDir}
        onToggleSort={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((f) => !f)}
        onlyMine={onlyMine}
        onToggleOnlyMine={() => setOnlyMine((m) => !m)}
        ctaLabel={can("maintenance:write") ? "Log incident" : undefined}
        onCtaClick={openCreate}
        barTitle="Incident flow"
        gaugePct={slaRate}
        gaugeLabel="SLA adherence"
        kpi1Value={openCount}
        kpi1Label="Open corrective tickets"
        kpi1Href="/events"
        kpi2Value={resolvedCount}
        kpi2Label="Resolved this cycle"
        kpi2Href="/reports"
        filterBar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {["ALL", ...SEVERITIES].map((s) => (
                <button
                  key={s}
                  onClick={() => setSevFilter(s)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                    sevFilter === s
                      ? "bg-[#18181A] text-white border-[#18181A]"
                      : "bg-white text-[#525258] border-[#E4E4DC]"
                  }`}
                >
                  {s === "ALL" ? "All severities" : s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-white border border-[#E4E4DC] rounded-lg p-0.5">
              <button
                onClick={() => setView("board")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium ${
                  view === "board" ? "bg-[#18181A] text-white" : "text-[#525258]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Board
              </button>
              <button
                onClick={() => setView("table")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium ${
                  view === "table" ? "bg-[#18181A] text-white" : "text-[#525258]"
                }`}
              >
                <Table2 className="w-3.5 h-3.5" /> Table
              </button>
            </div>
          </div>
        }
      />

      <div className="px-6 lg:px-8 py-6">
        {view === "board" ? (
          <KanbanBoard
            columns={[...STAGES]}
            items={cards}
            canEdit={can("maintenance:write")}
            onMoveStage={handleMoveStage}
            onOpenDetail={(card) => openEditById(card.id)}
          />
        ) : (
          <div className="rounded-[14px] border border-[#ECECE7] overflow-x-auto bg-white">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#FAF9F5] border-b border-[#ECECE7] text-[#78787E] text-[12px]">
                <tr>
                  <th className="py-3 px-4 font-medium">Ticket</th>
                  <th className="py-3 px-4 font-medium">Incident</th>
                  <th className="py-3 px-4 font-medium">Customer / Service</th>
                  <th className="py-3 px-4 font-medium">Severity</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Assignee</th>
                  <th className="py-3 px-4 font-medium">SLA Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1EC]">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openEditById(row.id)}
                    className="hover:bg-[#FAF9F5] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-[12px]">{row.ticketCode}</td>
                    <td className="py-3 px-4 font-medium text-[#18181A]">{row.title}</td>
                    <td className="py-3 px-4 text-[#525258]">
                      {row.customerName || "—"} {row.serviceCode ? `· ${row.serviceCode}` : ""}
                    </td>
                    <td className="py-3 px-4">{row.severity}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#F4F4F1] text-[#18181A]">
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#525258]">{row.assigneeName || "Unassigned"}</td>
                    <td className="py-3 px-4 text-[#78787E]">{formatShortDate(row.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
