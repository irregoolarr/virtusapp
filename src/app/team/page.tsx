"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Shield, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridTabs, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Pill } from "@/components/grid/cells";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { cn, getInitials } from "@/lib/utils";

interface TeamUserRow {
  id: number;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  phone: string | null;
  avatarColor: string;
  availability: string;
  isActive: boolean;
  roleId: number;
  roleName: string;
  roleSlug: string;
}

interface RoleRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  memberCount: number;
}

interface PermDef {
  key: string;
  module: string;
  label: string;
}

export default function TeamRbacPage() {
  const { user, can, refreshAuth, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<"members" | "roles" | "scopes" | "groups">("members");
  const [team, setTeam] = useState<TeamUserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermDef[]>([]);
  const [search, setSearch] = useState("");

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUserRow | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    jobTitle: "",
    department: "Managed Services",
    phone: "",
    availability: "Online",
    isActive: true,
    roleId: "",
  });

  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
  });

  const loadAll = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch("/api/users", { cache: "no-store" }),
      fetch("/api/roles", { cache: "no-store" }),
    ]);
    if (uRes.ok) {
      const uData = await uRes.json();
      setTeam(uData.items ?? []);
    }
    if (rRes.ok) {
      const rData = await rRes.json();
      setRoles(rData.items ?? []);
      setPerms(rData.availablePermissions ?? []);
    }
  }, []);

  useEffect(() => {
    if (user) void loadAll();
  }, [user, loadAll]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return team;
    return team.filter((u) =>
      `${u.name} ${u.email} ${u.jobTitle} ${u.roleName}`.toLowerCase().includes(q)
    );
  }, [team, search]);

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      name: "",
      email: "",
      password: "",
      jobTitle: "",
      department: "Managed Services",
      phone: "",
      availability: "Online",
      isActive: true,
      roleId: roles[2]?.id ? String(roles[2].id) : String(roles[0]?.id ?? ""),
    });
    setUserModalOpen(true);
  };

  const openEditUser = (u: TeamUserRow) => {
    setEditingUser(u);
    setUserForm({
      name: u.name,
      email: u.email,
      password: "",
      jobTitle: u.jobTitle,
      department: u.department,
      phone: u.phone ?? "",
      availability: u.availability,
      isActive: u.isActive,
      roleId: String(u.roleId),
    });
    setUserModalOpen(true);
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: userForm.name,
        jobTitle: userForm.jobTitle,
        department: userForm.department,
        phone: userForm.phone || null,
        availability: userForm.availability,
        isActive: userForm.isActive,
        roleId: Number(userForm.roleId),
      };
      if (!editingUser) {
        payload.email = userForm.email;
        payload.password = userForm.password;
      } else if (userForm.password.trim()) {
        payload.password = userForm.password.trim();
      }

      const res = await fetch(
        editingUser ? `/api/users/${editingUser.id}` : "/api/users",
        {
          method: editingUser ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Failed to save user", "error");
        return;
      }
      notify(editingUser ? "Team member updated" : "Team member invited");
      setUserModalOpen(false);
      await Promise.all([loadAll(), refreshLookups(), refreshAuth()]);
    } finally {
      setSaving(false);
    }
  };

  const toggleRolePermission = async (role: RoleRow, permKey: string) => {
    if (!can("rbac:manage")) {
      notify("Only Super Admin can modify RBAC permissions", "error");
      return;
    }
    const exists = role.permissions.includes(permKey);
    const nextPerms = exists
      ? role.permissions.filter((p) => p !== permKey)
      : [...role.permissions, permKey];

    const res = await fetch(`/api/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: nextPerms }),
    });
    if (res.ok) {
      notify(`Updated ${role.name} permission: ${permKey}`);
      await Promise.all([loadAll(), refreshAuth()]);
    } else {
      const err = await res.json();
      notify(err.error || "Permission update blocked", "error");
    }
  };

  const createCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleForm.name,
          description: roleForm.description,
          permissions: ["dashboard:read"],
        }),
      });
      if (!res.ok) {
        notify("Failed to create role", "error");
        return;
      }
      notify("Custom role created");
      setRoleModalOpen(false);
      setRoleForm({ name: "", description: "" });
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const permsByModule = useMemo(() => {
    const groups = new Map<string, PermDef[]>();
    for (const p of perms) {
      groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
    }
    return Array.from(groups.entries());
  }, [perms]);

  const activeUsersCount = team.filter((t) => t.isActive).length;

  const userColumns: GridColumn<TeamUserRow>[] = [
    {
      key: "name",
      header: "Name",
      width: 200,
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full text-[10px] font-semibold text-white flex items-center justify-center shrink-0"
            style={{ backgroundColor: r.avatarColor || "#475569" }}
          >
            {r.name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          {r.name}
        </span>
      ),
    },
    { key: "email", header: "Email", width: 220 },
    { key: "jobTitle", header: "Job Title", width: 200 },
    { key: "department", header: "Department", width: 150 },
    { key: "roleName", header: "Role", width: 150 },
    { key: "availability", header: "Availability", width: 120 },
    {
      key: "isActive",
      header: "Account",
      width: 100,
      value: (r) => (r.isActive ? "Active" : "Disabled"),
      render: (r) => <Pill tone={r.isActive ? "normal" : "critical"}>{r.isActive ? "Active" : "Disabled"}</Pill>,
    },
    { key: "phone", header: "Phone", width: 150 },
  ];

  const roleColumns: GridColumn<RoleRow>[] = [
    { key: "name", header: "Role", width: 180 },
    { key: "slug", header: "Key", width: 160 },
    { key: "description", header: "Description", width: 360, wrap: true },
    { key: "memberCount", header: "Members", width: 90, align: "right" },
    { key: "permissionCount", header: "Scopes", width: 90, align: "right", value: (r) => r.permissions.length },
    {
      key: "isSystem",
      header: "Type",
      width: 100,
      value: (r) => (r.isSystem ? "System" : "Custom"),
      render: (r) => <Pill tone={r.isSystem ? "low" : "normal"}>{r.isSystem ? "System" : "Custom"}</Pill>,
    },
  ];

  type GroupRow = { id: string; department: string; members: TeamUserRow[] };
  const groups: GroupRow[] = Object.values(
    team.reduce<Record<string, GroupRow>>((acc, u) => {
      const key = u.department || "Unassigned";
      (acc[key] ??= { id: key, department: key, members: [] }).members.push(u);
      return acc;
    }, {})
  ).filter((g) => `${g.department} ${g.members.map((m) => m.name).join(" ")}`.toLowerCase().includes(search.toLowerCase()));

  const groupColumns: GridColumn<GroupRow>[] = [
    { key: "department", header: "Group", width: 200 },
    { key: "count", header: "Members", width: 90, align: "right", value: (g) => g.members.length },
    { key: "active", header: "Active", width: 90, align: "right", value: (g) => g.members.filter((m) => m.isActive).length },
    { key: "roles", header: "Roles", width: 240, value: (g) => [...new Set(g.members.map((m) => m.roleName))].join(", ") },
    { key: "names", header: "Members", width: 360, wrap: true, value: (g) => g.members.map((m) => m.name).join(", ") },
  ];

  return (
    <AppShell>
      <GridPage>
        <h1 className="text-[22px] font-bold text-[#2B3036]">User Management</h1>
        <GridTabs
          tabs={[
            { key: "members", label: "Members" },
            { key: "roles", label: "Roles" },
            { key: "scopes", label: "Scopes" },
            { key: "groups", label: "Groups" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "members" && (
          <DataGrid
            key="members"
            title="Members"
            columns={userColumns}
            rows={filteredUsers}
            getRowId={(r) => r.id}
            exportName="team-members"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search member, role, department..."
            onRefresh={() => void loadAll()}
            onOpen={(r) => openEditUser(r)}
            rowTone={(r) => (!r.isActive ? "critical" : undefined)}
            actions={[
              { label: "New", onClick: openCreateUser, hidden: !can("users:manage") },
              { label: "Open", needsSelection: true, onClick: (r) => r && openEditUser(r) },
            ]}
            detail={(r) => (
              <DetailList
                items={[
                  ["Name", r.name],
                  ["Email", r.email],
                  ["Phone", r.phone],
                  ["Job Title", r.jobTitle],
                  ["Department", r.department],
                  ["Role", r.roleName],
                ]}
              />
            )}
          />
        )}

        {tab === "roles" && (
          <DataGrid
            key="roles"
            title="Roles"
            columns={roleColumns}
            rows={roles.filter((r) => `${r.name} ${r.slug} ${r.description}`.toLowerCase().includes(search.toLowerCase()))}
            getRowId={(r) => r.id}
            exportName="roles"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search roles..."
            onRefresh={() => void loadAll()}
            actions={[
              { label: "New", onClick: () => setRoleModalOpen(true), hidden: !can("rbac:manage") },
              { label: "Edit Scopes", onClick: () => setTab("scopes") },
            ]}
            detail={(r) => (
              <DetailList
                items={[
                  ["Role", r.name],
                  ["Description", r.description],
                  ["Members", team.filter((u) => u.roleId === r.id).map((u) => u.name).join(", ") || "No members"],
                  ["Scopes", r.permissions.join(", ")],
                ]}
              />
            )}
          />
        )}

        {tab === "groups" && (
          <DataGrid
            key="groups"
            title="Groups"
            columns={groupColumns}
            rows={groups}
            getRowId={(g) => g.id}
            exportName="groups"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search groups or members..."
            onRefresh={() => void loadAll()}
            detail={(g) => (
              <DetailList
                items={g.members.map((m) => [m.name, `${m.jobTitle} · ${m.roleName}${m.isActive ? "" : " · Disabled"}`] as [string, string])}
              />
            )}
          />
        )}

        {tab === "scopes" && (
          <section className="bg-white border border-[#D9DEE3] flex flex-col min-w-0">
            <div className="px-4 pt-3 flex items-baseline gap-2">
              <h2 className="text-[16px] font-semibold text-[#2B3036]">Scopes</h2>
              <span className="text-[12.5px] text-[#6B7280]">
                {can("rbac:manage") ? "Click a cell to grant or revoke a permission." : "Read-only. Super Admin can edit permissions."}
              </span>
            </div>
            <div className="flex items-center px-2.5 py-1.5 border-b border-[#D9DEE3]">
              {can("rbac:manage") && (
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(true)}
                  className="h-8 px-2 text-[12.5px] font-semibold uppercase tracking-[0.02em] text-[#1668AC] hover:text-[#0F4F86]"
                >
                  New Role
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadAll()}
                className="h-8 px-2 text-[12.5px] font-semibold uppercase tracking-[0.02em] text-[#1668AC] hover:text-[#0F4F86]"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(100vh-215px)]">
              <table className="w-full text-left text-[13px] text-[#2B3036] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-white px-3 h-12 font-semibold border-b border-[#D9DEE3] min-w-[260px]">
                      Permission
                    </th>
                    {roles.map((r) => (
                      <th key={r.id} className="sticky top-0 z-10 bg-white px-3 h-12 text-center font-semibold border-b border-[#D9DEE3] whitespace-nowrap">
                        <div>{r.name}</div>
                        <div className="text-[11px] font-normal text-[#6B7280]">{r.memberCount} member(s)</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permsByModule.map(([mod, list]) => (
                    <React.Fragment key={mod}>
                      <tr className="bg-[#EEF1F4]">
                        <td colSpan={roles.length + 1} className="px-3 py-1.5 text-[12px] font-semibold text-[#4B5563]">
                          {mod}
                        </td>
                      </tr>
                      {list.map((p, i) => (
                        <tr key={p.key} className={i % 2 === 1 ? "bg-[#F6F7F8]" : "bg-white"}>
                          <td className="px-3 py-2">
                            <div>{p.label}</div>
                            <div className="font-mono text-[11px] text-[#6B7280]">{p.key}</div>
                          </td>
                          {roles.map((role) => {
                            const active = role.permissions.includes(p.key);
                            return (
                              <td key={role.id} className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  disabled={!can("rbac:manage")}
                                  onClick={() => void toggleRolePermission(role, p.key)}
                                  aria-pressed={active}
                                  aria-label={`${active ? "Revoke" : "Grant"} ${p.key} for ${role.name}`}
                                  className={cn(
                                    "w-5 h-5 inline-flex items-center justify-center border",
                                    active ? "bg-[#1668AC] border-[#1668AC] text-white" : "bg-white border-[#B7C0C9] text-transparent hover:border-[#1668AC]",
                                    !can("rbac:manage") && "cursor-default"
                                  )}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </GridPage>

      {/* User Modal */}
      <RecordModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? editingUser.name : "Add Team Member"}
        subtitle={editingUser?.email}
      >
        <form onSubmit={saveUser} className="space-y-4">
          <FieldLabel label="Full Name" required>
            <input
              type="text"
              required
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          {!editingUser && (
            <FieldLabel label="Work Email" required>
              <input
                type="email"
                required
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          )}
          <FieldLabel label={editingUser ? "Reset Password (leave blank to keep)" : "Initial Password"} required={!editingUser}>
            <input
              type="password"
              required={!editingUser}
              minLength={6}
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Job Title" required>
              <input
                type="text"
                required
                value={userForm.jobTitle}
                onChange={(e) => setUserForm({ ...userForm, jobTitle: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Department">
              <input
                type="text"
                value={userForm.department}
                onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="RBAC Role" required>
              <select
                required
                value={userForm.roleId}
                onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                className={inputClass}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Availability">
              <select
                value={userForm.availability}
                onChange={(e) => setUserForm({ ...userForm, availability: e.target.value })}
                className={inputClass}
              >
                <option value="Online">Online</option>
                <option value="On Duty">On Duty</option>
                <option value="Away">Away</option>
                <option value="Offline">Offline</option>
              </select>
            </FieldLabel>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[#2B3036]">
            <input
              type="checkbox"
              checked={userForm.isActive}
              onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
            />
            Account Active
          </label>
          <FormActions onCancel={() => setUserModalOpen(false)} saving={saving} />
        </form>
      </RecordModal>

      {/* New Custom Role Modal */}
      <RecordModal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title="Create Custom RBAC Role"
      >
        <form onSubmit={createCustomRole} className="space-y-4">
          <FieldLabel label="Role Name" required>
            <input
              type="text"
              required
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              className={inputClass}
              placeholder="e.g. NOC Shift Lead"
            />
          </FieldLabel>
          <FieldLabel label="Description">
            <textarea
              rows={2}
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FormActions onCancel={() => setRoleModalOpen(false)} saving={saving} submitLabel="Create Role" />
        </form>
      </RecordModal>
    </AppShell>
  );
}
