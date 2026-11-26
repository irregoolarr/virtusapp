"use client";

import { useEffect, useState } from "react";

/** Fired by the notification bell when the record's page is already open. */
export const OPEN_RECORD_EVENT = "vms:open-record";

function idFromUrl(): number | null {
  const id = Number(new URLSearchParams(window.location.search).get("open"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Deep link `<page>?open=<id>` (used by the notification bell): opens that record's
 * window once its row has loaded, then removes `open` from the address bar.
 */
export function useOpenFromLink<T extends { id: number }>(items: T[], open: (row: T) => void) {
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    setPendingId(idFromUrl());
    const onEvent = (e: Event) => setPendingId((e as CustomEvent<{ id: number }>).detail.id);
    window.addEventListener(OPEN_RECORD_EVENT, onEvent);
    return () => window.removeEventListener(OPEN_RECORD_EVENT, onEvent);
  }, []);

  useEffect(() => {
    if (pendingId === null) return;
    const row = items.find((r) => r.id === pendingId);
    if (!row) return; // not loaded yet (or deleted) — keep waiting for the list
    setPendingId(null);
    open(row);
    const params = new URLSearchParams(window.location.search);
    if (params.has("open")) {
      params.delete("open");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, [pendingId, items, open]);
}
