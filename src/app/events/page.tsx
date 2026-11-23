"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Clock, MailCheck, Play, RefreshCw, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
import { RecordModal } from "@/components/RecordModal";
import { FieldLabel, FormActions, inputClass } from "@/components/FormFields";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { cn, formatDateTime } from "@/lib/utils";

const EVENT_TYPES = [
  "PM Reminder",
  "SLA Alert",
  "Contract Renewal",
  "POC Review",
  "Implementation Milestone",
  "Weekly Report",
  "Custom Event",
] as const;

interface EventRow {
  id: number;
  eventCode: string;
  title: string;
  description: string;
  eventType: string;
  linkedModule: string;
  linkedRefCode: string | null;
  scheduledAt: string;
  nextRunAt: string;
  recurrence: string;
  reminderMinutesBefore: number;
  recipientEmails: string[];
  emailSubject: string;
  emailBody: string;
  status: string;
  lastSentAt: string | null;
  createdByName: string | null;
}

interface AlertLogRow {
  id: number;
  eventId: number | null;
  recipientEmails: string[];
  subject: string;
  bodyPreview: string;
  deliveryMode: string;
  status: string;
  messageId: string | null;
  errorMessage: string | null;
  sentAt: string;
}

export default function EventsPage() {
  const { user, can, refreshLookups } = useAuth();
  const { notify } = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [logs, setLogs] = useState<AlertLogRow[]>([]);
  const [tab, setTab] = useState<"schedules" | "outbox">("schedules");
  const [search, setSearch] = useState("");
  const [runningDue, setRunningDue] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    eventType: "PM Reminder",
    linkedModule: "general",
    linkedRefCode: "",
    scheduledAt: "",
    recurrence: "Once",
    reminderMinutesBefore: 60,
    recipientsCsv: "",
    emailSubject: "",
    emailBody: "",
    status: "Scheduled",
  });

  const loadData = useCallback(async () => {
    const res = await fetch("/api/events", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setEvents(data.items ?? []);
      setLogs(data.logs ?? []);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadData();
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get("ref");
      if (refCode && can("events:write")) {
        const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 16);
        setEditing(null);
        setForm({
          title: `Contract Renewal Reminder (${refCode})`,
          description: `Follow up on renewal & SLA terms for ${refCode}.`,
          eventType: "Contract Renewal",
          linkedModule: "service",
          linkedRefCode: refCode,
          scheduledAt: tomorrow,
          recurrence: "Once",
          reminderMinutesBefore: 1440,
          recipientsCsv: user.email,
          emailSubject: `[Contract Renewal] Action required for ${refCode}`,
          emailBody: `Reminder to review renewal agreement and SLA compliance for ${refCode}.`,
          status: "Scheduled",
        });
        setModalOpen(true);
      }
    }
  }, [user, loadData, can]);

  const filteredEvents = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return events;
    return events.filter((e) =>
      `${e.eventCode} ${e.title} ${e.eventType} ${e.linkedRefCode ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [events, search]);

  const filteredLogs = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter((l) =>
      `${l.subject} ${l.bodyPreview} ${l.recipientEmails.join(" ")}`
        .toLowerCase()
        .includes(q)
    );
  }, [logs, search]);

  const openCreate = () => {
    setEditing(null);
    const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 16);
    setForm({
      title: "",
      description: "",
      eventType: "PM Reminder",
      linkedModule: "general",
      linkedRefCode: "",
      scheduledAt: tomorrow,
      recurrence: "Once",
      reminderMinutesBefore: 60,
      recipientsCsv: user?.email || "noc@virtusms.io",
      emailSubject: "[VirtusMS Reminder] Scheduled Operational Alert",
      emailBody: "Automated operational reminder from VirtusMS Managed Services.",
      status: "Scheduled",
    });
    setModalOpen(true);
  };

  const openEdit = (ev: EventRow) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description,
      eventType: ev.eventType,
      linkedModule: ev.linkedModule,
      linkedRefCode: ev.linkedRefCode ?? "",
      scheduledAt: new Date(ev.scheduledAt).toISOString().slice(0, 16),
      recurrence: ev.recurrence,
      reminderMinutesBefore: ev.reminderMinutesBefore,
      recipientsCsv: (ev.recipientEmails ?? []).join(", "),
      emailSubject: ev.emailSubject,
      emailBody: ev.emailBody,
      status: ev.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const recipientEmails = form.recipientsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: form.title,
        description: form.description,
        eventType: form.eventType,
        linkedModule: form.linkedModule,
        linkedRefCode: form.linkedRefCode || null,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        recurrence: form.recurrence,
        reminderMinutesBefore: Number(form.reminderMinutesBefore),
        recipientEmails,
        emailSubject: form.emailSubject,
        emailBody: form.emailBody,
        status: form.status,
      };

      const res = await fetch(editing ? `/api/events/${editing.id}` : "/api/events", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        notify(err.error || "Failed to save event", "error");
        return;
      }
      notify(editing ? "Event schedule updated" : "Reminder event scheduled");
      setModalOpen(false);
      await Promise.all([loadData(), refreshLookups()]);
    } finally {
      setSaving(false);
    }
  };

  const triggerEventNow = async (eventId?: number) => {
    setRunningDue(true);
    try {
      const res = await fetch("/api/events/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventId ? { eventId } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Failed to dispatch email alert", "error");
        return;
      }
      if (eventId && data.dispatched) {
        notify(
          `Alert ${data.dispatched.status} via ${data.dispatched.deliveryMode}`,
          data.dispatched.status === "Failed" ? "error" : "success"
        );
      } else {
        notify(`Processed ${data.processedCount ?? 0} due reminder(s)`);
      }
      await Promise.all([loadData(), refreshLookups()]);
    } finally {
      setRunningDue(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    const res = await fetch(`/api/events/${editing.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Event removed");
      setModalOpen(false);
      await Promise.all([loadData(), refreshLookups()]);
    }
  };

  const scheduledCount = events.filter((e) => e.status === "Scheduled").length;

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search reminder events, linked refs, email subjects..."
        ctaLabel={can("events:write") ? "Schedule reminder" : undefined}
        onCtaClick={openCreate}
        barTitle="Alert cadence"
        gaugePct={
          logs.length > 0
            ? Math.round((logs.filter((l) => l.status !== "Failed").length / logs.length) * 100)
            : 100
        }
        gaugeLabel="Alert delivery success"
        kpi1Value={scheduledCount}
        kpi1Label="Scheduled reminders"
        kpi1Href="/events"
        kpi2Value={logs.length}
        kpi2Label="Dispatched alert emails"
        kpi2Href="/settings"
      />

      <div className="px-6 lg:px-8 py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("schedules")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium border",
                tab === "schedules"
                  ? "bg-[#18181A] text-white border-[#18181A]"
                  : "bg-white text-[#525258] border-[#E4E4DC]"
              )}
            >
              <BellRing className="w-4 h-4" />
              <span>Scheduled Reminders ({filteredEvents.length})</span>
            </button>
            <button
              onClick={() => setTab("outbox")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium border",
                tab === "outbox"
                  ? "bg-[#18181A] text-white border-[#18181A]"
                  : "bg-white text-[#525258] border-[#E4E4DC]"
              )}
            >
              <MailCheck className="w-4 h-4" />
              <span>Email Alert Outbox ({filteredLogs.length})</span>
            </button>
          </div>

          {can("events:dispatch") && (
            <button
              type="button"
              disabled={runningDue}
              onClick={() => void triggerEventNow()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] border border-[#E2E2DA] bg-white hover:bg-[#FAF9F5] text-[12.5px] font-medium text-[#18181A]"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", runningDue && "animate-spin")} />
              <span>Run Due Reminders Now</span>
            </button>
          )}
        </div>

        {tab === "schedules" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => openEdit(ev)}
                className="rounded-[14px] border border-[#ECECE7] bg-white p-5 hover:border-[#D0D0C8] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-[#8E8E93]">{ev.eventCode}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F4F4F1] text-[#18181A]">
                        {ev.eventType}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] border border-[#E6E6DF] text-[#525258]">
                        {ev.recurrence}
                      </span>
                      {ev.linkedRefCode && (
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#18181A] text-white">
                          {ev.linkedRefCode}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0",
                        ev.status === "Scheduled"
                          ? "bg-emerald-50 text-emerald-700"
                          : ev.status === "Failed"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-[#F4F4F1] text-[#525258]"
                      )}
                    >
                      {ev.status}
                    </span>
                  </div>

                  <h3 className="mt-2.5 text-[15.5px] font-semibold text-[#18181A]">
                    {ev.title}
                  </h3>
                  <p className="mt-1 text-[12.5px] text-[#78787E] line-clamp-2">
                    {ev.description}
                  </p>

                  <div className="mt-3 text-[12px] text-[#525258]">
                    <span className="text-[#8E8E93]">Recipients: </span>
                    {(ev.recipientEmails ?? []).join(", ")}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F1F1EC] flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-1.5 text-[#525258]">
                    <Clock className="w-3.5 h-3.5 text-[#8E8E93]" />
                    <span>Next run: {formatDateTime(ev.nextRunAt)}</span>
                  </div>
                  {can("events:dispatch") && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void triggerEventNow(ev.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#18181A] text-white hover:bg-[#2C2C30] text-[11.5px] font-medium"
                    >
                      <Send className="w-3 h-3" /> Send Email Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-[#ECECE7] bg-white overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#FAF9F5] border-b border-[#ECECE7] text-[12px] text-[#78787E]">
                <tr>
                  <th className="py-3 px-4 font-medium">Sent At</th>
                  <th className="py-3 px-4 font-medium">Subject</th>
                  <th className="py-3 px-4 font-medium">Recipients</th>
                  <th className="py-3 px-4 font-medium">Mode</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F1EC]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF9F5]">
                    <td className="py-3 px-4 text-[12px] text-[#525258] whitespace-nowrap">
                      {formatDateTime(log.sentAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#18181A]">{log.subject}</div>
                      <div className="text-[11.5px] text-[#78787E] line-clamp-1">
                        {log.bodyPreview}
                      </div>
                      {log.errorMessage && (
                        <div className="text-[11px] text-rose-600 mt-0.5">{log.errorMessage}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[12px] text-[#525258]">
                      {(log.recipientEmails ?? []).join(", ")}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#525258]">
                      {log.deliveryMode}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-medium",
                          log.status === "Sent"
                            ? "bg-emerald-50 text-emerald-700"
                            : log.status === "Failed"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-[#F4F4F1] text-[#18181A]"
                        )}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? editing.title : "Schedule Reminder & Email Alert"}
        subtitle={editing?.eventCode}
        canDelete={Boolean(editing && can("events:delete"))}
        onDelete={handleDelete}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FieldLabel label="Event Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Event Type">
              <select
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                className={inputClass}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Recurrence">
              <select
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                className={inputClass}
              >
                <option value="Once">Once</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </FieldLabel>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FieldLabel label="Scheduled Date & Time" required>
              <input
                type="datetime-local"
                required
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Lead Time (mins)">
              <input
                type="number"
                min={0}
                value={form.reminderMinutesBefore}
                onChange={(e) =>
                  setForm({ ...form, reminderMinutesBefore: Number(e.target.value) })
                }
                className={inputClass}
              />
            </FieldLabel>
            <FieldLabel label="Linked Ref Code">
              <input
                type="text"
                value={form.linkedRefCode}
                onChange={(e) => setForm({ ...form, linkedRefCode: e.target.value })}
                className={inputClass}
                placeholder="e.g. SRV-2026-1003"
              />
            </FieldLabel>
          </div>
          <FieldLabel label="Description" required>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Recipient Emails (comma separated)" required>
            <input
              type="text"
              required
              value={form.recipientsCsv}
              onChange={(e) => setForm({ ...form, recipientsCsv: e.target.value })}
              className={inputClass}
              placeholder="noc@virtusms.io, sandra@virtusms.io"
            />
          </FieldLabel>
          <FieldLabel label="Email Alert Subject" required>
            <input
              type="text"
              required
              value={form.emailSubject}
              onChange={(e) => setForm({ ...form, emailSubject: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>
          <FieldLabel label="Email Body" required>
            <textarea
              rows={4}
              required
              value={form.emailBody}
              onChange={(e) => setForm({ ...form, emailBody: e.target.value })}
              className={inputClass}
            />
          </FieldLabel>

          {editing && can("events:dispatch") && (
            <button
              type="button"
              onClick={() => void triggerEventNow(editing.id)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#E2E2DA] py-2 text-[12.5px] font-medium hover:bg-[#FAF9F5]"
            >
              <Play className="w-3.5 h-3.5" /> Dispatch Email Alert Immediately
            </button>
          )}

          {can("events:write") && (
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} />
          )}
        </form>
      </RecordModal>
    </AppShell>
  );
}
