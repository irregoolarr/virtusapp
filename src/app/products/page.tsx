"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, MoreVertical, Package } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency } from "@/lib/utils";
import type { ProductItem } from "@/shared/types";

type ProductRow = ProductItem;

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
    unitPriceIdr: 0,
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
      unitPriceIdr: 0,
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
      unitPriceIdr: p.unitPriceIdr,
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
        unitPriceIdr: Number(form.unitPriceIdr),
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

  const deleteRow = async (row: ProductRow | null) => {
    if (!row || !window.confirm(`Delete ${row.name}?`)) return;
    const res = await fetch(`/api/products/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Product removed");
      await Promise.all([loadItems(), refreshLookups()]);
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const columns: GridColumn<ProductRow>[] = [
    { key: "sku", header: "SKU", width: 140, render: (r) => <Mono>{r.sku}</Mono> },
    { key: "name", header: "Product / Solution", width: 220, wrap: true },
    { key: "category", header: "Category", width: 150 },
    { key: "vendorName", header: "Vendor", width: 150 },
    { key: "partnerName", header: "Partner", width: 160 },
    { key: "slaTargetHours", header: "SLA Target", width: 100, align: "right", render: (r) => `${r.slaTargetHours}h` },
    { key: "pricingModel", header: "Pricing", width: 120 },
    { key: "unitPriceIdr", header: "Unit Price", width: 110, align: "right", render: (r) => formatCurrency(r.unitPriceIdr) },
    { key: "activeDeployments", header: "Deployments", width: 110, align: "right" },
    { key: "status", header: "Status", width: 110, render: (r) => <Pill tone={r.status === "Active" ? "normal" : "low"}>{r.status}</Pill> },
  ];

  return (
    <AppShell>
      <GridPage>
        <DataGrid
          title="Products & Solutions"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          exportName="products"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search SKU, solution, vendor..."
          onRefresh={() => void loadItems()}
          onOpen={(r) => openEdit(r)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !can("products:write") },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("products:delete"), onClick: (r) => void deleteRow(r) },
          ]}
          filters={
            <GridSelect
              label="Category"
              value={catFilter}
              onChange={setCatFilter}
              options={["ALL", ...categories].map((c) => ({ value: c, label: c === "ALL" ? "All categories" : c }))}
            />
          }
          detail={(r) => (
            <DetailList
              items={[
                ["Description", r.description],
                ["Vendor", r.vendorName],
                ["Partner", r.partnerName],
                ["Pricing", `${formatCurrency(r.unitPriceIdr)} · ${r.pricingModel}`],
                ["SLA Target", `${r.slaTargetHours} hours`],
                ["Active Deployments", String(r.activeDeployments)],
              ]}
            />
          )}
        />
      </GridPage>

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
            <FieldLabel label="Unit Price (IDR)">
              <input
                type="number"
                min={0}
                value={form.unitPriceIdr}
                onChange={(e) => setForm({ ...form, unitPriceIdr: Number(e.target.value) })}
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
