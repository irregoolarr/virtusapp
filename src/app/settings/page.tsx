"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Mail, Send, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FieldLabel, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

export default function SettingsPage() {
  const { user, can } = useAuth();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");

  const [smtp, setSmtp] = useState({
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "VirtusMS Alerts <alerts@virtusms.io>",
    defaultAlertEmail: "noc@virtusms.io",
  });

  const [ops, setOps] = useState({
    companyName: "VirtusMS Managed Services",
    defaultSlaWarningDays: 30,
    autoEscalateCriticalMinutes: 30,
    currencySymbol: "$",
  });

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.smtp) setSmtp(data.smtp);
      if (data.ops) setOps(data.ops);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setTestRecipient(user.email);
      if (can("settings:manage")) void loadSettings();
    }
  }, [user, can, loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp: { ...smtp, port: Number(smtp.port) },
          ops: {
            ...ops,
            defaultSlaWarningDays: Number(ops.defaultSlaWarningDays),
            autoEscalateCriticalMinutes: Number(ops.autoEscalateCriticalMinutes),
          },
        }),
      });
      if (!res.ok) {
        notify("Failed to save settings", "error");
        return;
      }
      notify("SMTP & operational settings saved to PostgreSQL");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: testRecipient }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Test dispatch failed", "error");
        return;
      }
      notify(
        `Test alert ${data.dispatch.status} via ${data.dispatch.deliveryMode}`,
        data.dispatch.status === "Failed" ? "error" : "success"
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <AppShell>

      <div className="p-3 sm:p-4 bg-[#EEF1F4] flex-1 space-y-4">
        <h1 className="text-[18px] font-semibold text-[#2B3036]">Settings</h1>
        <div className="max-w-4xl space-y-4">
        {!can("settings:manage") ? (
          <div className="rounded-sm border border-[#D9DEE3] bg-[#F6F7F8] p-6 flex items-center gap-3 text-[13.5px] text-[#4B5563]">
            <ShieldAlert className="w-5 h-5 text-[#2B3036]" />
            <span>
              Settings access requires <code className="font-mono">settings:manage</code> permission (Super Admin).
            </span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="rounded-sm border border-[#D9DEE3] bg-white p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-semibold text-[#2B3036] flex items-center gap-2">
                    <Mail className="w-4 h-4" /> SMTP Email Alerting Transport
                  </h2>
                  <p className="mt-1 text-[12.5px] text-[#6B7280]">
                    Leave SMTP Host empty to log all scheduled reminders and alerts into the built-in Sandbox Outbox for safe testing, or enter your live SMTP credentials for real email delivery.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <FieldLabel label="SMTP Host">
                    <input
                      type="text"
                      value={smtp.host}
                      onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                      className={inputClass}
                      placeholder="smtp.resend.com or smtp.gmail.com"
                    />
                  </FieldLabel>
                </div>
                <FieldLabel label="SMTP Port">
                  <input
                    type="number"
                    value={smtp.port}
                    onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                    className={inputClass}
                  />
                </FieldLabel>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldLabel label="SMTP Username">
                  <input
                    type="text"
                    value={smtp.user}
                    onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="SMTP Password / App Key">
                  <input
                    type="password"
                    value={smtp.pass}
                    onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                    className={inputClass}
                  />
                </FieldLabel>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldLabel label="Sender From Header">
                  <input
                    type="text"
                    value={smtp.from}
                    onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="Default NOC Fallback Email">
                  <input
                    type="email"
                    required
                    value={smtp.defaultAlertEmail}
                    onChange={(e) =>
                      setSmtp({ ...smtp, defaultAlertEmail: e.target.value })
                    }
                    className={inputClass}
                  />
                </FieldLabel>
              </div>

              <label className="flex items-center gap-2 text-[13px] text-[#4B5563]">
                <input
                  type="checkbox"
                  checked={smtp.secure}
                  onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
                />
                Use implicit TLS (Port 465)
              </label>
            </div>

            <div className="rounded-sm border border-[#D9DEE3] bg-white p-6 space-y-4">
              <h2 className="text-[17px] font-semibold text-[#2B3036]">
                SLA & Contract Alert Thresholds
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FieldLabel label="Organization Display Name">
                  <input
                    type="text"
                    value={ops.companyName}
                    onChange={(e) => setOps({ ...ops, companyName: e.target.value })}
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="Contract Expiry Warning (Days)">
                  <input
                    type="number"
                    min={1}
                    value={ops.defaultSlaWarningDays}
                    onChange={(e) =>
                      setOps({ ...ops, defaultSlaWarningDays: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </FieldLabel>
                <FieldLabel label="Critical Escalation (Minutes)">
                  <input
                    type="number"
                    min={5}
                    value={ops.autoEscalateCriticalMinutes}
                    onChange={(e) =>
                      setOps({
                        ...ops,
                        autoEscalateCriticalMinutes: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </FieldLabel>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className={inputClass}
                  placeholder="test@virtusms.io"
                />
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => void handleSendTest()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#C9D0D7] bg-white hover:bg-[#F6F7F8] text-[12.5px] font-medium shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testing ? "Testing..." : "Send Test Alert"}
                </button>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-sm bg-[#1668AC] hover:bg-[#0F4F86] text-white text-[13px] font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </AppShell>
  );
}
