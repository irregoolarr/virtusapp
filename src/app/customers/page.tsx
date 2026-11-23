"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Handshake, Mail, MapPin, MoreVertical, Phone, UserCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { cn, getInitials } from "@/lib/utils";

interface CustomerRow {
  id: number;
  code: string;
  name: string;
  industry: string;
  tier: string;
  status: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  managerId: number | null;
  managerName: string | null;
  managerAvatarColor: string | null;
  serviceCount: number;
}

interface PartnerRow {
  id: number;
  code: string;
  name: string;
  partnerType: string;
  tier: string;
  specialization: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  escalationEmail: string | null;
  address: string | null;
  status: string;
  notes: string | null;
}

export default function CustomersPartnersPage() {
  const { user, lookups, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<"customers" | "partners">("customers");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [editingPartner, setEditingPartner] = useState<PartnerRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [custForm, setCustForm] = useState({
    name: "",
    industry: "",
    tier: "Enterprise",
    status: "Active",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    notes: "",
    managerId: "",
  });

  const [partnerForm, setPartnerForm] = useState({
    name: "",
    partnerType: "Vendor / Principal",
    tier: "Gold",
    specialization: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    escalationEmail: "",
    address: "",
    status: "Active",
    notes: "",
  });

  const loadAll = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch("/api/customers", { cache: "no-store" }),
      fetch("/api/partners", { cache: "no-store" }),
    ]);
    if (cRes.ok) {
      const cData = await cRes.json();
      setCustomers(cData.items ?? []);
      if (!selectedId && cData.items?.[0]) setSelectedId(cData.items[0].id);
    }
    if (pRes.ok) {
      const pData = await pRes.json();
      setPartners(pData.items ?? []);
    }
  }, [selectedId]);

  useEffect(() => {
    if (user) void loadAll();
  }, [user, loadAll]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (onlyMine && user && c.managerId !== user.id) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return `${c.code} ${c.name} ${c.industry} ${c.contactName} ${c.contactEmail}`
        .toLowerCase()
        .includes(q);
    });
  }, [customers, onlyMine, user, search]);

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return `${p.code} ${p.name} ${p.partnerType} ${p.specialization} ${p.contactName}`
        .toLowerCase()
        .includes(q);
    });
  }, [partners, search]);

  const openCreate = () => {
    if (tab === "customers") {
      setEditingCustomer(null);
      setEditingPartner(null);
      setCustForm({
        name: "",
        industry: "",
        tier: "Enterprise",
        status: "Active",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        address: "",
        notes: "",
        managerId: user ? String(user.id) : "",
      });
    } else {
      setEditingPartner(null);
      setEditingCustomer(null);
      setPartnerForm({
        name: "",
        partnerType: "Vendor / Principal",
        tier: "Gold",
        specialization: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        escalationEmail: "",
        address: "",
        status: "Active",
        notes: "",
      });
    }
    setModalOpen(true);
  };

  const openEditCustomer = (c: CustomerRow) => {
    setEditingCustomer(c);
    setEditingPartner(null);
    setCustForm({
      name: c.name,
      industry: c.industry,
      tier: c.tier,
      status: c.status,
      contactName: c.contactName,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone ?? "",
      address: c.address ?? "",
      notes: c.notes ?? "",
      managerId: c.managerId ? String(c.managerId) : "",
    });
    setModalOpen(true);
  };

  const openEditPartner = (p: PartnerRow) => {
    setEditingPartner(p);
    setEditingCustomer(null);
    setPartnerForm({
      name: p.name,
      partnerType: p.partnerType,
      tier: p.tier,
      specialization: p.specialization,
      contactName: p.contactName,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone ?? "",
      escalationEmail: p.escalationEmail ?? "",
      address: p.address ?? "",
      status: p.status,
      notes: p.notes ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (tab === "customers") {
        const res = await fetch(
          editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers",
          {
            method: editingCustomer ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...custForm,
              managerId: custForm.managerId ? Number(custForm.managerId) : null,
            }),
          }
        );
        if (!res.ok) {
          notify("Failed to save customer", "error");
          return;
        }
        notify(editingCustomer ? "Customer updated" : "Customer added");
      } else {
        const res = await fetch(
          editingPartner ? `/api/partners/${editingPartner.id}` : "/api/partners",
          {
            method: editingPartner ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(partnerForm),
          }
        );
        if (!res.ok) {
          notify("Failed to save business partner", "error");
          return;
        }
        notify(editingPartner ? "Business partner updated" : "Business partner added");
      }
      setModalOpen(false);
      await Promise.all([loadAll(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (tab === "customers" && editingCustomer) {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, { method: "DELETE" });
      if (res.ok) {
        notify("Customer deleted");
        setModalOpen(false);
        await Promise.all([loadAll(), refreshLookups()]);
      }
    } else if (tab === "partners" && editingPartner) {
      const res = await fetch(`/api/partners/${editingPartner.id}`, { method: "DELETE" });
      if (res.ok) {
        notify("Partner deleted");
        setModalOpen(false);
        await Promise.all([loadAll(), refreshLookups()]);
      }
    }
  };

  const activeCustomersCount = customers.filter((c) => c.status === "Active").length;
  const activePct =
    customers.length > 0 ? Math.round((activeCustomersCount / customers.length) * 100) : 100;

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          tab === "customers"
            ? "Search customer, industry, contact..."
            : "Search business partner, specialization..."
        }
        onlyMine={tab === "customers" ? onlyMine : undefined}
        onToggleOnlyMine={tab === "customers" ? () => setOnlyMine((m) => !m) : undefined}
        ctaLabel={
          can("customers:write")
            ? tab === "customers"
              ? "Add customer"
              : "Add partner"
            : undefined
        }
        onCtaClick={openCreate}
        barTitle="Account onboarding"
        gaugePct={activePct}
        gaugeLabel="Active customer accounts"
        kpi1Value={customers.length}
        kpi1Label="Registered customers"
        kpi1Href="/services"
        kpi2Value={partners.length}
        kpi2Label="Business partners"
        kpi2Href="/products"
      />

      <div className="px-6 lg:px-8 py-6 space-y-5">
        {/* Clean Pill Tab Switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("customers")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium border transition-colors",
              tab === "customers"
                ? "bg-[#18181A] text-white border-[#18181A]"
                : "bg-white text-[#525258] border-[#E4E4DC] hover:bg-[#FAF9F5]"
            )}
          >
            <Building2 className="w-4 h-4" />
            <span>Customers ({filteredCustomers.length})</span>
          </button>
          <button
            onClick={() => setTab("partners")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium border transition-colors",
              tab === "partners"
                ? "bg-[#18181A] text-white border-[#18181A]"
                : "bg-white text-[#525258] border-[#E4E4DC] hover:bg-[#FAF9F5]"
            )}
          >
            <Handshake className="w-4 h-4" />
            <span>Business Partners ({filteredPartners.length})</span>
          </button>
        </div>

        {/* Grid Cards */}
        {tab === "customers" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCustomers.map((c) => {
              const isDark = selectedId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "rounded-[14px] p-5 border transition-all cursor-pointer",
                    isDark
                      ? "bg-[#19191B] text-white border-[#19191B] shadow-lg"
                      : "bg-white text-[#18181A] border-[#ECECE7] hover:border-[#D0D0C8]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono text-[11px]", isDark ? "text-zinc-400" : "text-[#8E8E93]")}>
                          {c.code}
                        </span>
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full", isDark ? "bg-white/10 text-zinc-200" : "bg-[#F4F4F1] text-[#525258]")}>
                          {c.tier} · {c.status}
                        </span>
                      </div>
                      <h3 className="mt-1 text-[16px] font-semibold">{c.name}</h3>
                      <p className={cn("text-[12.5px]", isDark ? "text-zinc-400" : "text-[#78787E]")}>
                        {c.industry}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCustomer(c);
                      }}
                      className={cn("p-1 rounded-md", isDark ? "text-zinc-400 hover:text-white" : "text-[#8E8E93] hover:text-[#18181A]")}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  <div className={cn("mt-4 space-y-1.5 text-[12px]", isDark ? "text-zinc-300" : "text-[#525258]")}>
                    {c.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 opacity-70 shrink-0" />
                      <span className="truncate">{c.contactEmail}</span>
                    </div>
                    {c.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <span>{c.contactPhone}</span>
                      </div>
                    )}
                  </div>

                  <div className={cn("mt-4 pt-3 border-t flex items-center justify-between text-[12px]", isDark ? "border-white/10" : "border-[#F1F1EC]")}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded-full text-[10px] font-medium text-white flex items-center justify-center"
                        style={{ backgroundColor: c.managerAvatarColor || "#3F3F46" }}
                      >
                        {getInitials(c.managerName || "AM")}
                      </span>
                      <span className={isDark ? "text-zinc-300" : "text-[#525258]"}>
                        {c.managerName || "Unassigned"}
                      </span>
                    </div>
                    <span className={cn("font-mono text-[11px] px-2 py-0.5 rounded border", isDark ? "border-white/15 text-zinc-200" : "border-[#E6E6DF] text-[#525258]")}>
                      {c.serviceCount} services
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPartners.map((p) => (
              <div
                key={p.id}
                onClick={() => openEditPartner(p)}
                className="rounded-[14px] p-5 border border-[#ECECE7] bg-white hover:border-[#D0D0C8] transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[#8E8E93]">{p.code}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#18181A] text-white">
                        {p.tier}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F4F4F1] text-[#525258]">
                        {p.partnerType}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-[16px] font-semibold text-[#18181A]">{p.name}</h3>
                    <p className="mt-1 text-[12.5px] text-[#78787E]">{p.specialization}</p>
                  </div>
                  <MoreVertical className="w-4 h-4 text-[#8E8E93]" />
                </div>

                <div className="mt-4 pt-3 border-t border-[#F1F1EC] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] text-[#525258]">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#78787E]" />
                    <span>{p.contactName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#78787E]" />
                    <span className="truncate">{p.contactEmail}</span>
                  </div>
                  {p.escalationEmail && (
                    <div className="sm:col-span-2 text-[11.5px] text-[#78787E]">
                      Escalation desk: <span className="font-mono text-[#18181A]">{p.escalationEmail}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          tab === "customers"
            ? editingCustomer?.name || "New Customer"
            : editingPartner?.name || "New Business Partner"
        }
        subtitle={tab === "customers" ? editingCustomer?.code : editingPartner?.code}
        entityType={tab === "customers" ? "customer" : undefined}
        entityId={tab === "customers" ? editingCustomer?.id : undefined}
        canDelete={Boolean((editingCustomer || editingPartner) && can("customers:delete"))}
        onDelete={handleDelete}
      >
        {tab === "customers" ? (
          <form onSubmit={handleSave} className="space-y-4">
            <FieldLabel label="Company Name" required>
              <input
                type="text"
                required
                value={custForm.name}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <div className="grid grid-cols-3 gap-3">
              <FieldLabel label="Industry" required>
                <input
                  type="text"
                  required
                  value={custForm.industry}
                  onChange={(e) => setCustForm({ ...custForm, industry: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Tier">
                <select
                  value={custForm.tier}
                  onChange={(e) => setCustForm({ ...custForm, tier: e.target.value })}
                  className={inputClass}
                >
                  <option value="Enterprise">Enterprise</option>
                  <option value="Mid-Market">Mid-Market</option>
                  <option value="SMB">SMB</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Status">
                <select
                  value={custForm.status}
                  onChange={(e) => setCustForm({ ...custForm, status: e.target.value })}
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Prospect">Prospect</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Primary Contact" required>
                <input
                  type="text"
                  required
                  value={custForm.contactName}
                  onChange={(e) => setCustForm({ ...custForm, contactName: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Contact Email" required>
                <input
                  type="email"
                  required
                  value={custForm.contactEmail}
                  onChange={(e) => setCustForm({ ...custForm, contactEmail: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Phone">
                <input
                  type="text"
                  value={custForm.contactPhone}
                  onChange={(e) => setCustForm({ ...custForm, contactPhone: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Account Manager">
                <select
                  value={custForm.managerId}
                  onChange={(e) => setCustForm({ ...custForm, managerId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">— Unassigned —</option>
                  {(lookups?.users ?? []).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <FieldLabel label="Address">
              <input
                type="text"
                value={custForm.address}
                onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Notes">
              <textarea
                rows={2}
                value={custForm.notes}
                onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            {can("customers:write") && (
              <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
            )}
          </form>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <FieldLabel label="Partner Name" required>
              <input
                type="text"
                required
                value={partnerForm.name}
                onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <div className="grid grid-cols-3 gap-3">
              <FieldLabel label="Partner Type">
                <select
                  value={partnerForm.partnerType}
                  onChange={(e) => setPartnerForm({ ...partnerForm, partnerType: e.target.value })}
                  className={inputClass}
                >
                  <option value="Vendor / Principal">Vendor / Principal</option>
                  <option value="System Integrator">System Integrator</option>
                  <option value="Reseller">Reseller</option>
                  <option value="Subcontractor">Subcontractor</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Tier">
                <select
                  value={partnerForm.tier}
                  onChange={(e) => setPartnerForm({ ...partnerForm, tier: e.target.value })}
                  className={inputClass}
                >
                  <option value="Platinum">Platinum</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Authorized">Authorized</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Status">
                <select
                  value={partnerForm.status}
                  onChange={(e) => setPartnerForm({ ...partnerForm, status: e.target.value })}
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </FieldLabel>
            </div>
            <FieldLabel label="Specialization / Solutions" required>
              <input
                type="text"
                required
                value={partnerForm.specialization}
                onChange={(e) => setPartnerForm({ ...partnerForm, specialization: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Primary Contact" required>
                <input
                  type="text"
                  required
                  value={partnerForm.contactName}
                  onChange={(e) => setPartnerForm({ ...partnerForm, contactName: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Contact Email" required>
                <input
                  type="email"
                  required
                  value={partnerForm.contactEmail}
                  onChange={(e) => setPartnerForm({ ...partnerForm, contactEmail: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Escalation / TAC Email">
                <input
                  type="email"
                  value={partnerForm.escalationEmail}
                  onChange={(e) => setPartnerForm({ ...partnerForm, escalationEmail: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
              <FieldLabel label="Phone">
                <input
                  type="text"
                  value={partnerForm.contactPhone}
                  onChange={(e) => setPartnerForm({ ...partnerForm, contactPhone: e.target.value })}
                  className={inputClass}
                />
              </FieldLabel>
            </div>
            <FieldLabel label="Notes">
              <textarea
                rows={2}
                value={partnerForm.notes}
                onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            {can("customers:write") && (
              <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
            )}
          </form>
        )}
      </RecordModal>
    </AppShell>
  );
}
