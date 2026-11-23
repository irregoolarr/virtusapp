"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Shield, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
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
  const [tab, setTab] = useState<"users" | "rbac">("users");
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

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search team member, role, department..."
        ctaLabel={
          tab === "users" && can("users:manage")
            ? "Add member"
            : tab === "rbac" && can("rbac:manage")
              ? "New role"
              : undefined
        }
        onCtaClick={() => (tab === "users" ? openCreateUser() : setRoleModalOpen(true))}
        barTitle="Team coverage"
        gaugePct={
          team.length > 0 ? Math.round((activeUsersCount / team.length) * 100) : 100
        }
        gaugeLabel="Active team roster"
        kpi1Value={team.length}
        kpi1Label="Registered team members"
        kpi1Href="/team"
        kpi2Value={roles.length}
        kpi2Label="Configured RBAC roles"
        kpi2Href="/settings"
      />

      <div className="px-6 lg:px-8 py-6 space-y-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("users")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium border",
              tab === "users"
                ? "bg-[#18181A] text-white border-[#18181A]"
                : "bg-white text-[#525258] border-[#E4E4DC]"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Team Members ({filteredUsers.length})</span>
          </button>
          <button
            onClick={() => setTab("rbac")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium border",
              tab === "rbac"
                ? "bg-[#18181A] text-white border-[#18181A]"
                : "bg-white text-[#525258] border-[#E4E4DC]"
            )}
          >
            <Shield className="w-4 h-4" />
            <span>Role-Based Access Control ({roles.length})</span>
          </button>
        </div>

        {tab === "users" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUsers.map((m) => (
              <div
                key={m.id}
                onClick={() => can("users:manage") && openEditUser(m)}
                className={cn(
                  "rounded-[14px] border border-[#ECECE7] bg-white p-5 transition-all",
                  can("users:manage") && "hover:border-[#D0D0C8] cursor-pointer"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold text-white"
                        style={{ backgroundColor: m.avatarColor || "#18181A" }}
                      >
                        {getInitials(m.name)}
                      </div>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white",
                          m.availability === "Online" || m.availability === "On Duty"
                            ? "bg-emerald-500"
                            : m.availability === "Away"
                              ? "bg-amber-400"
                              : "bg-zinc-300"
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#18181A]">{m.name}</h3>
                      <p className="text-[12px] text-[#78787E]">{m.jobTitle}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium px-2.5 py-0.5 rounded-full",
                      m.isActive
                        ? "bg-[#18181A] text-white"
                        : "bg-zinc-100 text-zinc-500"
                    )}
                  >
                    {m.roleName}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F1F1EC] space-y-1 text-[12px] text-[#525258]">
                  <div>{m.email}</div>
                  <div className="flex items-center justify-between text-[#8E8E93]">
                    <span>{m.department}</span>
                    <span>{m.isActive ? m.availability : "Deactivated"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[14px] border border-[#ECECE7] bg-[#FAF9F5] p-4 flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
              <span className="text-[#525258]">
                {can("rbac:manage")
                  ? "Click any permission cell below to grant or revoke module capabilities in PostgreSQL."
                  : "Viewing RBAC matrix in read-only mode. Super Admin role is required to edit permissions."}
              </span>
              {can("rbac:manage") && (
                <button
                  onClick={() => setRoleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181A] text-white text-[12px] font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Custom Role
                </button>
              )}
            </div>

            <div className="rounded-[14px] border border-[#ECECE7] bg-white overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-[#FAF9F5] border-b border-[#ECECE7]">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-[#18181A] min-w-[230px]">
                      Module / Capability
                    </th>
                    {roles.map((r) => (
                      <th key={r.id} className="py-3 px-3 text-center font-semibold text-[#18181A]">
                        <div>{r.name}</div>
                        <div className="text-[10.5px] font-normal text-[#8E8E93]">
                          {r.memberCount} member(s)
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F1EC]">
                  {permsByModule.map(([mod, list]) => (
                    <React.Fragment key={mod}>
                      <tr className="bg-[#FAF9F5]/60">
                        <td
                          colSpan={roles.length + 1}
                          className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-[#78787E]"
                        >
                          {mod}
                        </td>
                      </tr>
                      {list.map((p) => (
                        <tr key={p.key} className="hover:bg-[#FAF9F5]">
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-[#18181A]">{p.label}</div>
                            <div className="font-mono text-[10.5px] text-[#8E8E93]">{p.key}</div>
                          </td>
                          {roles.map((role) => {
                            const active = role.permissions.includes(p.key);
                            return (
                              <td key={role.id} className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  disabled={!can("rbac:manage")}
                                  onClick={() => void toggleRolePermission(role, p.key)}
                                  className={cn(
                                    "w-6 h-6 rounded-md inline-flex items-center justify-center border transition-colors",
                                    active
                                      ? "bg-[#18181A] border-[#18181A] text-white"
                                      : "bg-white border-[#DFDFD6] text-transparent hover:border-[#18181A]",
                                    !can("rbac:manage") && "opacity-70 cursor-default"
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
          </div>
        )}
      </div>

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
          <label className="flex items-center gap-2 text-[13px] text-[#18181A]">
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
