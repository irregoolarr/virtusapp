"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, FilePlus2, Trash2 } from "lucide-react";
import { Dialog, TextButton } from "@/components/Dialog";
import { DataGrid, type GridColumn } from "@/components/grid/DataGrid";
import { FieldLabel, inputClass } from "@/components/FormFields";
import { useToast } from "@/components/ToastProvider";
import { formatDateTime } from "@/lib/utils";
import type { ActivityItem } from "@/shared/types";

const columns: GridColumn<ActivityItem>[] = [
  { key: "type", header: "Type", width: 110 },
  { key: "category", header: "Category", width: 150 },
  { key: "subject", header: "Subject", width: 340, wrap: true },
  { key: "actorName", header: "By", width: 130 },
  { key: "createdAt", header: "Created On", width: 160, render: (r) => formatDateTime(r.createdAt) },
  { key: "updatedAt", header: "Modified On", width: 160, render: (r) => formatDateTime(r.updatedAt) },
];

/** Timeline of a record: emails sent, status/priority/owner changes, files and notes. */
export function ActivityHistory({
  entityType,
  entityId,
  canEdit,
  refreshKey = 0,
}: {
  entityType: string;
  entityId: number;
  canEdit: boolean;
  refreshKey?: number;
}) {
  const { notify } = useToast();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState({ subject: "", body: "" });
  const [savingNote, setSavingNote] = useState(false);
  const [viewing, setViewing] = useState<ActivityItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/activities?entityType=${entityType}&entityId=${entityId}`, { cache: "no-store" });
      if (res.ok) setItems((await res.json()).items ?? []);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNote(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, ...note }),
      });
      if (!res.ok) {
        notify((await res.json().catch(() => ({}))).error || "Could not add note", "error");
        return;
      }
      setNoteOpen(false);
      setNote({ subject: "", body: "" });
      notify("Note added");
      await load();
    } finally {
      setSavingNote(false);
    }
  };

  const remove = async (row: ActivityItem | null) => {
    if (!row) return;
    if (row.type !== "Note") {
      notify("System history can't be deleted — only notes.", "error");
      return;
    }
    if (!window.confirm(`Delete note "${row.subject}"?`)) return;
    const res = await fetch(`/api/activities/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("Note deleted");
      await load();
    } else {
      notify((await res.json().catch(() => ({}))).error || "Could not delete note", "error");
    }
  };

  return (
    <section data-ignore-dirty>
      <h3 className="text-[13px] font-semibold text-[#2B3036] mb-2">Activity History</h3>
      <DataGrid
        variant="panel"
        columns={columns}
        rows={items}
        getRowId={(r) => r.id}
        loading={loading}
        maxHeight="max-h-[320px]"
        emptyMessage="No activity yet"
        onOpen={setViewing}
        actions={[
          { label: "New Note", icon: FilePlus2, onClick: () => setNoteOpen(true), hidden: !canEdit },
          { label: "Delete", icon: Trash2, tone: "danger", needsSelection: true, hidden: !canEdit, onClick: (r) => void remove(r) },
          { label: "Go to", icon: ArrowRight, needsSelection: true, onClick: (r) => r && setViewing(r) },
        ]}
      />

      <Dialog open={noteOpen} title="New Note" onClose={() => setNoteOpen(false)}>
        <form onSubmit={saveNote} className="space-y-3">
          <FieldLabel label="Subject" required>
            <input required maxLength={300} value={note.subject} onChange={(e) => setNote({ ...note, subject: e.target.value })} className={inputClass} />
          </FieldLabel>
          <FieldLabel label="Details">
            <textarea rows={4} maxLength={5000} value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} className={inputClass} />
          </FieldLabel>
          <div className="flex justify-end gap-1 pt-1">
            <TextButton onClick={() => setNoteOpen(false)}>Cancel</TextButton>
            <TextButton type="submit" tone="primary" disabled={savingNote || !note.subject.trim()}>
              {savingNote ? "Saving..." : "Add Note"}
            </TextButton>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(viewing)} title={viewing ? `${viewing.type} · ${viewing.category}` : ""} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="space-y-3 text-[13px]">
            <div className="font-semibold text-[#2B3036]">{viewing.subject}</div>
            <div className="text-[12px] text-[#6B7280]">
              {viewing.actorName ?? "System"} · {formatDateTime(viewing.createdAt)}
            </div>
            {viewing.body ? (
              <pre className="whitespace-pre-wrap font-sans text-[13px] text-[#374151] bg-[#F6F7F8] border border-[#E9ECEF] p-3 max-h-[50vh] overflow-auto">
                {viewing.body}
              </pre>
            ) : (
              <p className="text-[#6B7280]">No further details.</p>
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
}
