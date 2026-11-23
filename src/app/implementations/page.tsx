"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare, Plus, Square } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
import { KanbanBoard, KanbanCardItem } from "@/components/KanbanBoard";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

const STAGES = ["Kickoff", "Configuration", "UAT / Staging", "Go-Live"] as const;

interface MilestoneItem {
  id: string;
  title: string;
  completed: boolean;
}

interface ImplementationRow {
  id: number;
  projectCode: string;
  title: string;
  description: string;
  status: string;
  progressPct: number;
  targetGoLive: string | null;
  milestones: MilestoneItem[];
  blockers: string | null;
  customerId: number | null;
  partnerId: number | null;
  serviceNumberId: number | null;
  productId: number | null;
  leadUserId: number | null;
  customerName: string | null;
  customerAddress: string | null;
  customerEmail: string | null;
  assigneeName: string | null;
  assigneeJobTitle: string | null;
  assigneeAvatarColor: string | null;
  commentCount: number;
  attachmentCount: number;
}

export default function ImplementationsPage() {
  const { user, lookups, can } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<ImplementationRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ImplementationRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "Kickoff",
    progressPct: 20,
    targetGoLive: "",
    blockers: "",
    milestones: [] as MilestoneItem[],
    customerId: "",
    partnerId: "",
    serviceNumberId: "",
    productId: "",
    leadUserId: "",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/implementations", { cache: "no-store" });
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
        return `${i.projectCode} ${i.title} ${i.description} ${i.customerName ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        sortDir === "asc" ? a.progressPct - b.progressPct : b.progressPct - a.progressPct
      );
  }, [items, onlyMine, user, search, sortDir]);

  const avgProgress =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.progressPct, 0) / items.length)
      : 0;
  const liveCount = items.filter((i) => i.status === "Go-Live").length;

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: "",
      description: "",
      status: "Kickoff",
      progressPct: 15,
      targetGoLive: new Date(Date.now() + 21 * 86400_000).toISOString().slice(0, 10),
      blockers: "",
      milestones: [
        { id: "m1", title: "Architecture & kickoff sign-off", completed: true },
        { id: "m2", title: "Staging & cutover execution", completed: false },
      ],
      customerId: lookups?.customers[0]?.id ? String(lookups.customers[0].id) : "",
      partnerId: "",
      serviceNumberId: "",
      productId: lookups?.products[0]?.id ? String(lookups.products[0].id) : "",
      leadUserId: user ? String(user.id) : "",
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
      status: found.status,
      progressPct: found.progressPct,
      targetGoLive: found.targetGoLive
        ? new Date(found.targetGoLive).toISOString().slice(0, 10)
        : "",
      blockers: found.blockers ?? "",
      milestones: Array.isArray(found.milestones) ? found.milestones : [],
      customerId: found.customerId ? String(found.customerId) : "",
      partnerId: found.partnerId ? String(found.partnerId) : "",
      serviceNumberId: found.serviceNumberId ? String(found.serviceNumberId) : "",
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
        progressPct: Number(form.progressPct),
        targetGoLive: form.targetGoLive || null,
        blockers: form.blockers || null,
        milestones: form.milestones,
        customerId: form.customerId ? Number(form.customerId) : null,
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        serviceNumberId: form.serviceNumberId ? Number(form.serviceNumberId) : null,
        productId: form.productId ? Number(form.productId) : null,
        leadUserId: form.leadUserId ? Number(form.leadUserId) : null,
      };
      const res = await fetch(
        editing ? `/api/implementations/${editing.id}` : "/api/implementations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        notify(err.error || "Failed to save implementation", "error");
        return;
      }
      notify(editing ? "Implementation updated" : "Implementation created");
      setModalOpen(false);
      await loadItems();
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStage = async (id: number, nextStage: string) => {
    const res = await fetch(`/api/implementations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStage }),
    });
    if (res.ok) {
      notify(`Implementation moved to ${nextStage}`);
      await loadItems();
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/implementations/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Implementation removed");
      setModalOpen(false);
      await loadItems();
    }
  };

  const cards: KanbanCardItem[] = filtered.map((i) => ({
    id: i.id,
    code: i.projectCode,
    title: i.title,
    description: i.description,
    stage: i.status,
    date: i.targetGoLive,
    customerName: i.customerName,
    customerAddress: i.customerAddress,
    customerEmail: i.customerEmail,
    extraLine: i.blockers ? `Blocker: ${i.blockers}` : `${i.progressPct}% completed`,
    assigneeName: i.assigneeName,
    assigneeJobTitle: i.assigneeJobTitle,
    assigneeAvatarColor: i.assigneeAvatarColor,
    commentCount: i.commentCount,
    attachmentCount: i.attachmentCount,
    badgeText: `${i.progressPct}%`,
    badgeTone: i.status === "Go-Live" ? "success" : "neutral",
  }));

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deployment project or customer..."
        sortDir={sortDir}
        onToggleSort={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        onlyMine={onlyMine}
        onToggleOnlyMine={() => setOnlyMine((m) => !m)}
        ctaLabel={can("delivery:write") ? "New rollout" : undefined}
        onCtaClick={openCreate}
        barTitle="Rollout velocity"
        gaugePct={avgProgress}
        gaugeLabel="Average rollout progress"
        kpi1Value={items.length - liveCount}
        kpi1Label="Active deployments"
        kpi1Href="/services"
        kpi2Value={liveCount}
        kpi2Label="Completed Go-Lives"
        kpi2Href="/reports"
      />

      <div className="px-6 lg:px-8 py-6">
        <KanbanBoard
          columns={[...STAGES]}
          items={cards}
          canEdit={can("delivery:write")}
          onMoveStage={handleMoveStage}
          onOpenDetail={openEdit}
        />
      </div>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "New Implementation Rollout"}
        subtitle={editing?.projectCode}
        entityType="implementation"
        entityId={editing?.id}
        canDelete={Boolean(editing && can("delivery:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FieldLabel label="Project Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Scope Description" required>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Phase">
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
            <FieldLabel label="Progress (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.progressPct}
                onChange={(e) => setForm({ ...form, progressPct: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Target Go-Live">
              <input
                type="date"
                value={form.targetGoLive}
                onChange={(e) => setForm({ ...form, targetGoLive: e.target.value })}
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
            <FieldLabel label="Implementation Lead">
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
          <FieldLabel label="Blockers / Dependencies">
            <input
              type="text"
              value={form.blockers}
              onChange={(e) => setForm({ ...form, blockers: e.target.value })}
              className={inputClass}
              placeholder="Hardware lead time, firewall approvals..."
            />
          </FieldLabel>

          {/* Milestones */}
          <div className="space-y-2">
            <div className="text-[12px] font-medium text-[#525258]">Rollout Milestones</div>
            {form.milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    milestones: form.milestones.map((item) =>
                      item.id === m.id ? { ...item, completed: !item.completed } : item
                    ),
                  })
                }
                className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg border border-[#ECECE7] hover:bg-[#FAF9F5] text-[12.5px]"
              >
                {m.completed ? (
                  <CheckSquare className="w-4 h-4 text-[#18181A]" />
                ) : (
                  <Square className="w-4 h-4 text-[#8E8E93]" />
                )}
                <span className={m.completed ? "line-through text-[#8E8E93]" : "text-[#18181A]"}>
                  {m.title}
                </span>
              </button>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                placeholder="Add milestone..."
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newMilestone.trim()) return;
                  setForm({
                    ...form,
                    milestones: [
                      ...form.milestones,
                      { id: `ms-${Date.now()}`, title: newMilestone.trim(), completed: false },
                    ],
                  });
                  setNewMilestone("");
                }}
                className="px-3 py-2 rounded-[10px] border border-[#E2E2DA] text-[12.5px] font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {can("delivery:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
