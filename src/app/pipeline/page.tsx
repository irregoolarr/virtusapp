"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
import { KanbanBoard, KanbanCardItem } from "@/components/KanbanBoard";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency } from "@/lib/utils";

const STAGES = ["Contacted", "Negotiation", "Offer Sent", "Deal Closed"] as const;

interface PipelineDealRow {
  id: number;
  dealCode: string;
  title: string;
  description: string;
  stage: string;
  dealValueUsd: number;
  probabilityPct: number;
  expectedCloseDate: string | null;
  customerId: number | null;
  partnerId: number | null;
  productId: number | null;
  ownerId: number | null;
  customerName: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  assigneeName: string | null;
  assigneeJobTitle: string | null;
  assigneeAvatarColor: string | null;
  commentCount: number;
  attachmentCount: number;
}

export default function PipelinePage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<PipelineDealRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState("ALL");
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PipelineDealRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    stage: "Contacted",
    dealValueUsd: 3500,
    probabilityPct: 35,
    expectedCloseDate: "",
    customerId: "",
    partnerId: "",
    productId: "",
    ownerId: "",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/pipeline", { cache: "no-store" });
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
      .filter((item) => {
        if (onlyMine && user && item.ownerId !== user.id) return false;
        if (stageFilter !== "ALL" && item.stage !== stageFilter) return false;
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return `${item.dealCode} ${item.title} ${item.description} ${item.customerName ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        sortDir === "asc" ? a.dealValueUsd - b.dealValueUsd : b.dealValueUsd - a.dealValueUsd
      );
  }, [items, onlyMine, user, stageFilter, search, sortDir]);

  const closedValue = items
    .filter((i) => i.stage === "Deal Closed")
    .reduce((sum, i) => sum + i.dealValueUsd, 0);
  const activeCount = items.filter((i) => i.stage !== "Deal Closed").length;
  const winPct =
    items.length > 0
      ? Math.round((items.filter((i) => i.stage === "Deal Closed").length / items.length) * 100)
      : 0;

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      stage: "Contacted",
      dealValueUsd: 3500,
      probabilityPct: 35,
      expectedCloseDate: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
      customerId: lookups?.customers[0]?.id ? String(lookups.customers[0].id) : "",
      partnerId: "",
      productId: lookups?.products[0]?.id ? String(lookups.products[0].id) : "",
      ownerId: user ? String(user.id) : "",
    });
    setModalOpen(true);
  };

  const openEdit = (card: KanbanCardItem) => {
    const found = items.find((i) => i.id === card.id);
    if (!found) return;
    setEditing(found);
    setForm({
      title: found.title,
      description: found.description,
      stage: found.stage,
      dealValueUsd: found.dealValueUsd,
      probabilityPct: found.probabilityPct,
      expectedCloseDate: found.expectedCloseDate
        ? new Date(found.expectedCloseDate).toISOString().slice(0, 10)
        : "",
      customerId: found.customerId ? String(found.customerId) : "",
      partnerId: found.partnerId ? String(found.partnerId) : "",
      productId: found.productId ? String(found.productId) : "",
      ownerId: found.ownerId ? String(found.ownerId) : "",
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
        stage: form.stage,
        dealValueUsd: Number(form.dealValueUsd),
        probabilityPct: Number(form.probabilityPct),
        expectedCloseDate: form.expectedCloseDate || null,
        customerId: form.customerId ? Number(form.customerId) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        productId: form.productId ? Number(form.productId) : null,
        ownerId: form.ownerId ? Number(form.ownerId) : null,
      };
      const url = editing ? `/api/pipeline/${editing.id}` : "/api/pipeline";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        notify(err.error || "Failed to save deal", "error");
        return;
      }
      notify(editing ? "Pipeline deal updated" : "Pipeline deal created");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (id: number, nextStage: string) => {
    const res = await fetch(`/api/pipeline/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: nextStage }),
    });
    if (res.ok) {
      notify(`Moved deal to ${nextStage}`);
      await Promise.all([loadItems(), refreshLookups()]);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/pipeline/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Deal removed");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } else {
      notify("Insufficient permission to delete", "error");
    }
  };

  const cards: KanbanCardItem[] = filtered.map((d) => ({
    id: d.id,
    code: d.dealCode,
    title: d.title,
    description: d.description,
    stage: d.stage,
    date: d.expectedCloseDate,
    customerName: d.customerName,
    customerAddress: d.customerAddress,
    customerEmail: d.customerEmail,
    assigneeName: d.assigneeName,
    assigneeJobTitle: d.assigneeJobTitle,
    assigneeAvatarColor: d.assigneeAvatarColor,
    commentCount: d.commentCount,
    attachmentCount: d.attachmentCount,
    badgeText: `${formatCurrency(d.dealValueUsd)} · ${d.probabilityPct}%`,
  }));

  const primeCard = items.find((i) => i.title === "Prime Estate");

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search pipeline deal or customer..."
        sortDir={sortDir}
        onToggleSort={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((s) => !s)}
        onlyMine={onlyMine}
        onToggleOnlyMine={() => setOnlyMine((m) => !m)}
        ctaLabel={can("pipeline:write") ? "Add deal" : undefined}
        onCtaClick={openCreate}
        barTitle="Pipeline intake"
        gaugePct={winPct || 68}
        gaugeLabel="Successful deals"
        kpi1Value={activeCount}
        kpi1Label="Deals in progress"
        kpi1Href="/poc"
        kpi2Value={formatCurrency(closedValue)}
        kpi2Label="Closed managed contracts"
        kpi2Href="/services"
        filterBar={
          <div className="flex flex-wrap items-center gap-2">
            {["ALL", ...STAGES].map((st) => (
              <button
                key={st}
                onClick={() => setStageFilter(st)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                  stageFilter === st
                    ? "bg-[#18181A] text-white border-[#18181A]"
                    : "bg-white text-[#525258] border-[#E4E4DC]"
                }`}
              >
                {st === "ALL" ? "All stages" : st}
              </button>
            ))}
          </div>
        }
      />

      <div className="px-6 lg:px-8 py-6">
        <KanbanBoard
          columns={[...STAGES]}
          items={cards}
          defaultSelectedId={primeCard?.id ?? cards[0]?.id}
          canEdit={can("pipeline:write")}
          onMoveStage={handleMoveStage}
          onOpenDetail={openEdit}
        />
      </div>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "New Pipeline Deal"}
        subtitle={editing?.dealCode}
        entityType="pipeline"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("pipeline:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FieldLabel label="Deal / Account Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              placeholder="e.g. Prime Estate Tower-B Managed SD-WAN"
            />
          </FieldLabel>
          <FieldLabel label="Scope Description" required>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Stage">
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className={inputClass}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Expected Close Date">
              <input
                type="date"
                value={form.expectedCloseDate}
                onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Deal Value (USD)">
              <input
                type="number"
                min={0}
                value={form.dealValueUsd}
                onChange={(e) => setForm({ ...form, dealValueUsd: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Win Probability (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.probabilityPct}
                onChange={(e) => setForm({ ...form, probabilityPct: Number(e.target.value) })}
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
            <FieldLabel label="Product / Solution">
              <select
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Select product —</option>
                {(lookups?.products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FieldLabel>
          </div>
          <FieldLabel label="Account Owner">
            <select
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              className={inputClass}
            >
              <option value="">— Unassigned —</option>
              {(lookups?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.jobTitle})</option>
              ))}
            </select>
          </FieldLabel>
          {can("pipeline:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
