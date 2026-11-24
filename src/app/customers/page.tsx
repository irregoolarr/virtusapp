"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Handshake, Mail, MapPin, MoreVertical, Phone, UserCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridTabs, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
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

  const deleteCustomer = async (row: CustomerRow | null) => {
    if (!row || !window.confirm(`Delete ${row.name}?`)) return;
    const res = await fetch(`/api/customers/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Customer deleted");
      await Promise.all([loadAll(), refreshLookups()]);
    } else {
      notify("Unable to delete customer", "error");
    }
  };

  const deletePartner = async (row: PartnerRow | null) => {
    if (!row || !window.confirm(`Delete ${row.name}?`)) return;
    const res = await fetch(`/api/partners/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Partner deleted");
      await Promise.all([loadAll(), refreshLookups()]);
    } else {
      notify("Unable to delete partner", "error");
    }
  };

  const statusPill = (status: string) => (
    <Pill tone={status === "Active" ? "normal" : status === "Inactive" || status === "Churned" ? "critical" : "low"}>{status}</Pill>
  );

  const customerColumns: GridColumn<CustomerRow>[] = [
    { key: "code", header: "Code", width: 110, render: (r) => <Mono>{r.code}</Mono> },
    { key: "name", header: "Customer", width: 200 },
    { key: "industry", header: "Industry", width: 150 },
    { key: "tier", header: "Tier", width: 110 },
    { key: "status", header: "Status", width: 130, render: (r) => statusPill(r.status) },
    { key: "contactName", header: "Contact", width: 160 },
    { key: "contactEmail", header: "Email", width: 220 },
    { key: "contactPhone", header: "Phone", width: 150 },
    { key: "serviceCount", header: "Services", width: 90, align: "right" },
    { key: "managerName", header: "Account Manager", width: 160 },
  ];

  const partnerColumns: GridColumn<PartnerRow>[] = [
    { key: "code", header: "Code", width: 110, render: (r) => <Mono>{r.code}</Mono> },
    { key: "name", header: "Partner", width: 200 },
    { key: "partnerType", header: "Type", width: 130 },
    { key: "tier", header: "Tier", width: 110 },
    { key: "status", header: "Status", width: 130, render: (r) => statusPill(r.status) },
    { key: "specialization", header: "Specialization", width: 220, wrap: true },
    { key: "contactName", header: "Contact", width: 160 },
    { key: "contactEmail", header: "Email", width: 220 },
    { key: "escalationEmail", header: "Escalation", width: 220 },
  ];

  return (
    <AppShell>
      <GridPage>
        <GridTabs
          tabs={[
            { key: "customers", label: `Customers (${filteredCustomers.length})` },
            { key: "partners", label: `Business Partners (${filteredPartners.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "customers" ? (
          <DataGrid
            key="customers"
            title="Customers"
            columns={customerColumns}
            rows={filteredCustomers}
            getRowId={(r) => r.id}
            exportName="customers"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search customer, industry, contact..."
            onRefresh={() => void loadAll()}
            onOpen={(r) => openEditCustomer(r)}
            actions={[
              { label: "New", onClick: openCreate, hidden: !can("customers:write") },
              { label: "Open", needsSelection: true, onClick: (r) => r && openEditCustomer(r) },
              { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("customers:delete"), onClick: (r) => void deleteCustomer(r) },
              { label: "My Accounts", active: onlyMine, onClick: () => setOnlyMine((m) => !m) },
            ]}
            detail={(r) => (
              <DetailList
                items={[
                  ["Customer", r.name],
                  ["Customer Location", r.address],
                  ["Email", r.contactEmail],
                  ["Phone", r.contactPhone],
                  ["Contact", r.contactName],
                  ["Account Manager", r.managerName],
                  ["Active Services", String(r.serviceCount)],
                  ["Notes", r.notes],
                ]}
              />
            )}
          />
        ) : (
          <DataGrid
            key="partners"
            title="Business Partners"
            columns={partnerColumns}
            rows={filteredPartners}
            getRowId={(r) => r.id}
            exportName="business-partners"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search partner, specialization..."
            onRefresh={() => void loadAll()}
            onOpen={(r) => openEditPartner(r)}
            actions={[
              { label: "New", onClick: openCreate, hidden: !can("customers:write") },
              { label: "Open", needsSelection: true, onClick: (r) => r && openEditPartner(r) },
              { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("customers:delete"), onClick: (r) => void deletePartner(r) },
            ]}
            detail={(r) => (
              <DetailList
                items={[
                  ["Partner", r.name],
                  ["Address", r.address],
                  ["Email", r.contactEmail],
                  ["Phone", r.contactPhone],
                  ["Escalation Email", r.escalationEmail],
                  ["Specialization", r.specialization],
                  ["Notes", r.notes],
                ]}
              />
            )}
          />
        )}
      </GridPage>

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
