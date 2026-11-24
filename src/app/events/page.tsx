"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Clock, MailCheck, Play, RefreshCw, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataGrid, GridPage, GridSelect, GridTabs, type GridColumn } from "@/components/grid/DataGrid";
import { DetailList } from "@/components/grid/DetailPane";
import { Mono, Pill, SegmentProgress, severityTone, stageRatio } from "@/components/grid/cells";
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

  const deleteRow = async (row: EventRow | null) => {
    if (!row || !window.confirm(`Delete ${row.eventCode}?`)) return;
    const res = await fetch(`/api/events/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Event removed");
      await Promise.all([loadData(), refreshLookups()]);
    } else {
      notify("Missing permission to delete", "error");
    }
  };

  const eventColumns: GridColumn<EventRow>[] = [
    { key: "eventCode", header: "Event", width: 120, render: (r) => <Mono>{r.eventCode}</Mono> },
    { key: "title", header: "Summary", width: 260, wrap: true },
    { key: "eventType", header: "Type", width: 160 },
    {
      key: "status",
      header: "Status",
      width: 110,
      render: (r) => <Pill tone={r.status === "Scheduled" ? "normal" : r.status === "Failed" ? "critical" : "low"}>{r.status}</Pill>,
    },
    { key: "recurrence", header: "Recurrence", width: 110 },
    { key: "nextRunAt", header: "Next Run", width: 170, render: (r) => formatDateTime(r.nextRunAt) },
    { key: "lastSentAt", header: "Last Sent", width: 170, value: (r) => r.lastSentAt ?? "", render: (r) => formatDateTime(r.lastSentAt) },
    { key: "linkedRefCode", header: "Linked Ref", width: 130 },
    { key: "recipients", header: "Recipients", width: 220, value: (r) => (r.recipientEmails ?? []).join(", ") },
    { key: "createdByName", header: "Created By", width: 140 },
  ];

  const logColumns: GridColumn<AlertLogRow>[] = [
    { key: "sentAt", header: "Sent On", width: 170, render: (r) => formatDateTime(r.sentAt) },
    { key: "subject", header: "Subject", width: 300, wrap: true },
    { key: "recipients", header: "Recipients", width: 240, value: (r) => (r.recipientEmails ?? []).join(", ") },
    { key: "deliveryMode", header: "Delivery", width: 110 },
    {
      key: "status",
      header: "Status",
      width: 100,
      render: (r) => <Pill tone={r.status === "Sent" ? "normal" : r.status === "Failed" ? "critical" : "low"}>{r.status}</Pill>,
    },
    { key: "errorMessage", header: "Error", width: 220 },
  ];

  return (
    <AppShell>
      <GridPage>
        <GridTabs
          tabs={[
            { key: "schedules", label: `Scheduled Reminders (${filteredEvents.length})` },
            { key: "outbox", label: `Email Alert Outbox (${filteredLogs.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "schedules" ? (
          <DataGrid
            key="schedules"
            title="Events & Alerts"
            columns={eventColumns}
            rows={filteredEvents}
            getRowId={(r) => r.id}
            exportName="events"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search events, refs, subjects..."
            onRefresh={() => void loadData()}
            onOpen={(r) => openEdit(r)}
            rowTone={(r) => (r.status === "Failed" ? "critical" : undefined)}
            actions={[
              { label: "New", onClick: openCreate, hidden: !can("events:write") },
              { label: "Open", needsSelection: true, onClick: (r) => r && openEdit(r) },
              { label: "Send Now", needsSelection: true, hidden: !can("events:dispatch"), disabled: runningDue, onClick: (r) => r && void triggerEventNow(r.id) },
              { label: runningDue ? "Running..." : "Run Due Reminders", hidden: !can("events:dispatch"), disabled: runningDue, onClick: () => void triggerEventNow() },
              { label: "Delete", needsSelection: true, tone: "danger", hidden: !can("events:delete"), onClick: (r) => void deleteRow(r) },
            ]}
            detail={(r) => (
              <DetailList
                items={[
                  ["Description", r.description],
                  ["Recipients", (r.recipientEmails ?? []).join(", ")],
                  ["Email Subject", r.emailSubject],
                  ["Linked Module", r.linkedModule],
                  ["Remind Before", `${r.reminderMinutesBefore} minutes`],
                  ["Scheduled At", formatDateTime(r.scheduledAt)],
                ]}
              />
            )}
          />
        ) : (
          <DataGrid
            key="outbox"
            title="Email Alert Outbox"
            columns={logColumns}
            rows={filteredLogs}
            getRowId={(r) => r.id}
            exportName="email-alert-outbox"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search subjects, recipients..."
            onRefresh={() => void loadData()}
            rowTone={(r) => (r.status === "Failed" ? "critical" : undefined)}
            detail={(r) => (
              <DetailList
                items={[
                  ["Subject", r.subject],
                  ["Recipients", (r.recipientEmails ?? []).join(", ")],
                  ["Message ID", r.messageId],
                  ["Error", r.errorMessage],
                  ["Body Preview", <span key="b" className="whitespace-pre-wrap">{r.bodyPreview}</span>],
                ]}
              />
            )}
          />
        )}
      </GridPage>

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
              className="w-full inline-flex items-center justify-center gap-2 rounded-sm border border-[#C9D0D7] py-2 text-[12.5px] font-medium hover:bg-[#F6F7F8]"
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
