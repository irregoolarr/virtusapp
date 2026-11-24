"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { FieldLabel, inputClass } from "@/components/FormFields";
import { GridPage } from "@/components/grid/DataGrid";

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

const primaryBtn =
  "h-9 px-4 rounded-sm bg-[#1668AC] hover:bg-[#0F4F86] text-white text-[13px] font-medium transition-colors disabled:opacity-45";

export default function ProfilePage() {
  const { user, refreshAuth } = useAuth();
  const { notify } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!user) return;
    const { first, last } = splitName(user.name);
    setFirstName(first);
    setLastName(last);
  }, [user]);

  const original = user ? splitName(user.name) : { first: "", last: "" };
  const nameChanged = firstName.trim() !== original.first || lastName.trim() !== original.last;

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Could not update your name", "error");
        return;
      }
      notify("Name updated");
      await refreshAuth();
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordError(data.error || "Could not change your password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify("Password changed. Other sessions were signed out.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AppShell>
      <GridPage>
        <h1 className="text-[22px] font-bold text-[#2B3036]">Profile Settings</h1>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-5xl">
          <form onSubmit={saveName} className="bg-white border border-[#D9DEE3]">
            <header className="px-5 py-3 border-b border-[#E9ECEF]">
              <h2 className="text-[14px] font-semibold text-[#2B3036]">Personal information</h2>
            </header>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldLabel label="First name" required>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="Last name">
                  <input
                    type="text"
                    maxLength={60}
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
              <FieldLabel label="Email">
                <input type="email" value={user?.email ?? ""} disabled className={`${inputClass} bg-[#F6F7F8] text-[#6B7280]`} />
              </FieldLabel>
              <p className="text-[12px] text-[#6B7280]">
                Email, role and job title are managed by an administrator in User Management.
              </p>
              <div className="flex justify-end">
                <button type="submit" disabled={savingName || !nameChanged || !firstName.trim()} className={primaryBtn}>
                  {savingName ? "Saving..." : "Save name"}
                </button>
              </div>
            </div>
          </form>

          <form onSubmit={savePassword} className="bg-white border border-[#D9DEE3]">
            <header className="px-5 py-3 border-b border-[#E9ECEF]">
              <h2 className="text-[14px] font-semibold text-[#2B3036]">Change password</h2>
            </header>
            <div className="p-5 space-y-4">
              <FieldLabel label="Current password" required>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                />
              </FieldLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldLabel label="New password" required>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="Confirm new password" required>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
              <p className="text-[12px] text-[#6B7280]">At least 8 characters. Changing it signs you out on other devices.</p>
              {passwordError && (
                <div role="alert" className="rounded-sm border border-[#F3B4B4] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#9F1C1C]">
                  {passwordError}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className={primaryBtn}
                >
                  {savingPassword ? "Updating..." : "Change password"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </GridPage>
    </AppShell>
  );
}
