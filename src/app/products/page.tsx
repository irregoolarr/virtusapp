"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, MoreVertical, Package } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency } from "@/lib/utils";

interface ProductRow {
  id: number;
  sku: string;
  name: string;
  category: string;
  vendorName: string;
  partnerId: number | null;
  partnerName: string | null;
  description: string;
  slaTargetHours: number;
  pricingModel: string;
  unitPriceUsd: number;
  status: string;
  activeDeployments: number;
}

export default function ProductsPage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    category: "Infrastructure",
    vendorName: "",
    partnerId: "",
    description: "",
    slaTargetHours: 4,
    pricingModel: "Monthly Managed",
    unitPriceUsd: 1500,
    status: "Active",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/products", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }, []);

  useEffect(() => {
    if (user) void loadItems();
  }, [user, loadItems]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))),
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (catFilter !== "ALL" && p.category !== catFilter) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return `${p.sku} ${p.name} ${p.category} ${p.vendorName} ${p.description}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, catFilter, search]);

  const totalDeployments = items.reduce((s, p) => s + p.activeDeployments, 0);

  const openCreate = () => {
    setEditing(null);
    setForm({
      sku: `PRD-SOL-${String(items.length + 1).padStart(2, "0")}`,
      name: "",
      category: "Infrastructure",
      vendorName: "VirtusMS Core",
      partnerId: "",
      description: "",
      slaTargetHours: 4,
      pricingModel: "Monthly Managed",
      unitPriceUsd: 1500,
      status: "Active",
    });
    setModalOpen(true);
  };

  const openEdit = (p: ProductRow) => {
    setEditing(p);
    setForm({
      sku: p.sku,
      name: p.name,
      category: p.category,
      vendorName: p.vendorName,
      partnerId: p.partnerId ? String(p.partnerId) : "",
      description: p.description,
      slaTargetHours: p.slaTargetHours,
      pricingModel: p.pricingModel,
      unitPriceUsd: p.unitPriceUsd,
      status: p.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        slaTargetHours: Number(form.slaTargetHours),
        unitPriceUsd: Number(form.unitPriceUsd),
        partnerId: form.partnerId ? Number(form.partnerId) : null,
      };
      const res = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        notify("Failed to save product", "error");
        return;
      }
      notify(editing ? "Solution updated" : "Solution added");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/products/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Solution deleted");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    }
  };

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search SKU, solution, vendor..."
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((s) => !s)}
        ctaLabel={can("products:write") ? "Add solution" : undefined}
        onCtaClick={openCreate}
        barTitle="Solution adoption"
        gaugePct={
          items.length > 0
            ? Math.round((items.filter((i) => i.status === "Active").length / items.length) * 100)
            : 100
        }
        gaugeLabel="Active catalog items"
        kpi1Value={items.length}
        kpi1Label="Products & solutions"
        kpi1Href="/poc"
        kpi2Value={totalDeployments}
        kpi2Label="Linked service deployments"
        kpi2Href="/services"
        filterBar={
          <div className="flex flex-wrap gap-2">
            {["ALL", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium border ${
                  catFilter === cat
                    ? "bg-[#18181A] text-white border-[#18181A]"
                    : "bg-white text-[#525258] border-[#E4E4DC]"
                }`}
              >
                {cat === "ALL" ? "All categories" : cat}
              </button>
            ))}
          </div>
        }
      />

      <div className="px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => openEdit(p)}
              className="rounded-[14px] border border-[#ECECE7] bg-white p-5 hover:border-[#D0D0C8] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-[#F4F4F1] text-[#18181A]">
                      <Package className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="font-mono text-[11px] text-[#8E8E93]">{p.sku}</span>
                      <div className="text-[11px] font-medium text-[#525258]">{p.category}</div>
                    </div>
                  </div>
                  <MoreVertical className="w-4 h-4 text-[#8E8E93]" />
                </div>

                <h3 className="mt-3.5 text-[16px] font-semibold text-[#18181A]">{p.name}</h3>
                <p className="mt-1.5 text-[12.5px] text-[#78787E] leading-relaxed line-clamp-2">
                  {p.description}
                </p>
              </div>

              <div className="mt-4 pt-3.5 border-t border-[#F1F1EC] flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-3 text-[#525258]">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#8E8E93]" />
                    {p.slaTargetHours}h SLA
                  </span>
                  <span>{p.activeDeployments} active</span>
                </div>
                <div className="font-semibold text-[#18181A] tabular-nums">
                  {formatCurrency(p.unitPriceUsd)}
                  <span className="text-[10.5px] font-normal text-[#8E8E93]"> /mo</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.name : "New Product / Solution"}
        subtitle={editing?.sku}
        canDelete={Boolean(editing && can("products:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="SKU" required>
              <input
                type="text"
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Category" required>
              <input
                type="text"
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          <FieldLabel label="Solution Name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Description" required>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Vendor / Principal" required>
              <input
                type="text"
                required
                value={form.vendorName}
                onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Linked Partner">
              <select
                value={form.partnerId}
                onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Internal / None —</option>
                {(lookups?.partners ?? []).map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </FieldLabel>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="SLA Target (Hours)">
              <input
                type="number"
                min={1}
                value={form.slaTargetHours}
                onChange={(e) => setForm({ ...form, slaTargetHours: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Unit Price (USD)">
              <input
                type="number"
                min={0}
                value={form.unitPriceUsd}
                onChange={(e) => setForm({ ...form, unitPriceUsd: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClass}
              >
                <option value="Active">Active</option>
                <option value="Beta">Beta</option>
                <option value="End of Support">End of Support</option>
              </select>
            </FieldLabel>
          </div>
          {can("products:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
