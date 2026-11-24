"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { cn, formatCurrency, formatShortDate } from "@/lib/utils";

interface ServiceRow {
  id: number;
  serviceNumber: string;
  title: string;
  category: string;
  slaTier: string;
  status: string;
  monthlyFeeUsd: number;
  startDate: string;
  endDate: string;
  customerId: number;
  partnerId: number | null;
  productId: number | null;
  picUserId: number | null;
  siteLocation: string | null;
  notes: string | null;
  customerName: string | null;
  partnerName: string | null;
  productName: string | null;
  picName: string | null;
}

export default function ServicesPage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<ServiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    serviceNumber: "",
    title: "",
    category: "Managed Network",
    slaTier: "24x7 Platinum",
    status: "Active",
    monthlyFeeUsd: 2500,
    startDate: "",
    endDate: "",
    customerId: "",
    partnerId: "",
    productId: "",
    picUserId: "",
    siteLocation: "",
    notes: "",
  });

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/services", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }, []);

  useEffect(() => {
    if (user) void loadItems();
  }, [user, loadItems]);

  const filtered = useMemo(() => {
    return items.filter((s) => {
      if (onlyMine && user && s.picUserId !== user.id) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return `${s.serviceNumber} ${s.title} ${s.customerName ?? ""} ${s.slaTier}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, onlyMine, user, statusFilter, search]);

  const activeCount = items.filter((s) => s.status === "Active").length;
  const expiringCount = items.filter((s) => {
    const days = (new Date(s.endDate).getTime() - Date.now()) / 86400_000;
    return days <= 30 && days >= 0;
  }).length;
  const totalMrr = items
    .filter((s) => s.status !== "Expired" && s.status !== "Suspended")
    .reduce((sum, s) => sum + s.monthlyFeeUsd, 0);

  const openCreate = () => {
    setEditing(null);
    setForm({
      serviceNumber: `SRV-${new Date().getFullYear()}-${1000 + items.length + 1}`,
      title: "",
      category: "Managed Network",
      slaTier: "24x7 Platinum",
      status: "Active",
      monthlyFeeUsd: 2500,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10),
      customerId: lookups?.customers[0]?.id ? String(lookups.customers[0].id) : "",
      partnerId: "",
      productId: lookups?.products[0]?.id ? String(lookups.products[0].id) : "",
      picUserId: user ? String(user.id) : "",
      siteLocation: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (row: ServiceRow) => {
    setEditing(row);
    setForm({
      serviceNumber: row.serviceNumber,
      title: row.title,
      category: row.category,
      slaTier: row.slaTier,
      status: row.status,
      monthlyFeeUsd: row.monthlyFeeUsd,
      startDate: new Date(row.startDate).toISOString().slice(0, 10),
      endDate: new Date(row.endDate).toISOString().slice(0, 10),
      customerId: String(row.customerId),
      partnerId: row.partnerId ? String(row.partnerId) : "",
      productId: row.productId ? String(row.productId) : "",
      picUserId: row.picUserId ? String(row.picUserId) : "",
      siteLocation: row.siteLocation ?? "",
      notes: row.notes ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        monthlyFeeUsd: Number(form.monthlyFeeUsd),
        customerId: Number(form.customerId),
        partnerId: form.partnerId ? Number(form.partnerId) : null,
        productId: form.productId ? Number(form.productId) : null,
        picUserId: form.picUserId ? Number(form.picUserId) : null,
      };
      const res = await fetch(editing ? `/api/services/${editing.id}` : "/api/services", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        notify(err.error || "Failed to save service number", "error");
        return;
      }
      notify(editing ? "Service number updated" : "Service number registered");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/services/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Service number removed");
      setModalOpen(false);
      await Promise.all([loadItems(), refreshLookups()]);
    }
  };

  const daysLeft = (end: string) => Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);

  const deleteRow = async (row: ServiceRow | null) => {
    if (!row || !window.confirm(`Delete ${row.serviceNumber}?`)) return;
    const res = await fetch(`/api/services/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Service number removed");
      await Promise.all([loadItems(), refreshLookups()]);
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const columns: GridColumn<ServiceRow>[] = [
    { key: "serviceNumber", header: "Service Number", width: 140, render: (r) => <Mono>{r.serviceNumber}</Mono> },
    { key: "title", header: "Summary", width: 240, wrap: true },
    { key: "category", header: "Category", width: 140 },
    { key: "customerName", header: "Customer", width: 170 },
    { key: "siteLocation", header: "Location", width: 150 },
    { key: "slaTier", header: "SLA Tier", width: 100 },
    {
      key: "status",
      header: "Status",
      width: 130,
      render: (r) => (
        <Pill tone={r.status === "Active" ? "normal" : r.status === "Expiring Soon" ? "high" : r.status === "Expired" || r.status === "Suspended" ? "critical" : "low"}>
          {r.status}
        </Pill>
      ),
    },
    { key: "monthlyFeeUsd", header: "Monthly Fee", width: 120, align: "right", render: (r) => formatCurrency(r.monthlyFeeUsd) },
    {
      key: "endDate",
      header: "Contract End",
      width: 130,
      render: (r) => {
        const d = daysLeft(r.endDate);
        return (
          <span className={cn("inline-flex items-center gap-1.5", d >= 0 && d <= 30 && "text-[#B45309] font-medium")}>
            {formatShortDate(r.endDate)}
            {d >= 0 && d <= 30 && <AlertTriangle className="w-3.5 h-3.5" />}
          </span>
        );
      },
    },
    { key: "picName", header: "Owner", width: 150 },
  ];

  return (
    <AppShell>
      <GridPage>
        <DataGrid
          title="Service Numbers"
          columns={columns}
          rows={filtered}
          getRowId={(r) => r.id}
          exportName="service-numbers"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search SRV number, customer, SLA..."
          onRefresh={() => void loadItems()}
          onOpen={(r) => openEdit(r)}
          actions={[
            { label: "New", onClick: openCreate, hidden: !can("services:write") },
            { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
            { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("services:delete"), onClick: (r) => void deleteRow(r) },
            { label: "My Items", active: onlyMine, onClick: () => setOnlyMine((m) => !m) },
          ]}
          filters={
            <GridSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={["ALL", "Active", "Provisioning", "Expiring Soon", "Suspended", "Expired"].map((s) => ({
                value: s,
                label: s === "ALL" ? "All statuses" : s,
              }))}
            />
          }
          detail={(r) => (
            <DetailList
              items={[
                ["Customer", r.customerName],
                ["Site Location", r.siteLocation],
                ["Product", r.productName],
                ["Partner", r.partnerName],
                ["Contract", `${formatShortDate(r.startDate)} – ${formatShortDate(r.endDate)}`],
                ["Days Remaining", String(daysLeft(r.endDate))],
                ["Notes", r.notes],
              ]}
            />
          )}
        />
      </GridPage>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "Register Service Number"}
        subtitle={editing?.serviceNumber}
        canDelete={Boolean(editing && can("services:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Service Number" required>
              <input
                type="text"
                required
                value={form.serviceNumber}
                onChange={(e) => setForm({ ...form, serviceNumber: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Customer" required>
              <select
                required
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
          <FieldLabel label="Service Name / Circuit Description" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Category">
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="SLA Tier">
              <select
                value={form.slaTier}
                onChange={(e) => setForm({ ...form, slaTier: e.target.value })}
                className={inputClass}
              >
                <option value="24x7 Platinum">24x7 Platinum</option>
                <option value="8x5 Gold">8x5 Gold</option>
                <option value="Standard">Standard</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClass}
              >
                <option value="Active">Active</option>
                <option value="Provisioning">Provisioning</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Suspended">Suspended</option>
                <option value="Expired">Expired</option>
              </select>
            </FieldLabel>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Monthly Fee (USD)">
              <input
                type="number"
                min={0}
                value={form.monthlyFeeUsd}
                onChange={(e) => setForm({ ...form, monthlyFeeUsd: Number(e.target.value) })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Start Date">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="End Date">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={inputClass}
              />
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
            <FieldLabel label="Assigned PIC">
              <select
                value={form.picUserId}
                onChange={(e) => setForm({ ...form, picUserId: e.target.value })}
                className={inputClass}
              >
                <option value="">— Unassigned —</option>
                {(lookups?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </FieldLabel>
          </div>
          <FieldLabel label="Site / Region Location">
            <input
              type="text"
              value={form.siteLocation}
              onChange={(e) => setForm({ ...form, siteLocation: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>

          {editing && (
            <button
              type="button"
              onClick={() => router.push(`/events?ref=${editing.serviceNumber}`)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-sm border border-[#C9D0D7] py-2 text-[12.5px] font-medium text-[#2B3036] hover:bg-[#F6F7F8]"
            >
              <BellPlus className="w-4 h-4" />
              Schedule Renewal Email Reminder for {editing.serviceNumber}
            </button>
          )}

          {can("services:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
