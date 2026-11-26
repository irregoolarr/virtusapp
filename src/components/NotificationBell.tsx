"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationItem, NotificationsResponse } from "@/shared/types";
import { OPEN_RECORD_EVENT } from "./useOpenFromLink";

const MODULE_LABEL: Record<NotificationItem["module"], string> = {
  corrective: "Corrective",
  preventive: "Preventive",
  implementation: "Implementation",
  poc: "POC",
  service: "Service Number",
};

const REFRESH_MS = 60_000;

/** Top-bar bell: breached/at-risk SLAs, PM visits due or overdue, go-lives, POC reviews, expiring contracts. */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Refresh after moving between pages (a record may just have been resolved).
  useEffect(() => {
    void load();
  }, [pathname, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const total = data ? data.counts.critical + data.counts.warning : 0;

  const goTo = (item: NotificationItem) => {
    setOpen(false);
    if (pathname === item.path) {
      window.dispatchEvent(new CustomEvent(OPEN_RECORD_EVENT, { detail: { id: item.recordId } }));
    } else {
      router.push(`${item.path}?open=${item.recordId}`);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        aria-expanded={open}
        aria-label={total ? `${total} notifications` : "Notifications"}
        title={total ? `${total} items need attention` : "Notifications"}
        className="relative flex w-10 h-10 rounded-sm items-center justify-center text-[#4B5563] hover:bg-[#EEF1F4] hover:text-[#1668AC]"
      >
        <Bell className="w-5 h-5" />
        {total > 0 && (
          <span
            className={cn(
              "absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold leading-4 text-center tabular-nums",
              data && data.counts.critical > 0 ? "bg-[#FF2224] text-white" : "bg-[#F59E0B] text-[#1F2937]"
            )}
          >
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-1.5rem)] rounded-sm border border-[#E2E8F0] bg-white text-[#0F172A] shadow-lg z-40">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F1F5F9]">
            <span className="text-[13px] font-semibold">Needs attention</span>
            {data && total > 0 && (
              <span className="text-[11.5px] text-[#64748B]">
                {data.counts.critical > 0 && <span className="text-[#DC2626] font-medium">{data.counts.critical} critical</span>}
                {data.counts.critical > 0 && data.counts.warning > 0 && " · "}
                {data.counts.warning > 0 && <span>{data.counts.warning} due soon</span>}
              </span>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {!data && !failed && <div className="px-3.5 py-6 text-[12.5px] text-[#64748B]">Loading…</div>}
            {failed && !data && <div className="px-3.5 py-6 text-[12.5px] text-[#64748B]">Notifications are unavailable right now.</div>}
            {data && total === 0 && (
              <div className="px-3.5 py-6 text-[12.5px] text-[#64748B]">Nothing needs attention. All SLAs, visits, go-lives, reviews and contracts are on track.</div>
            )}
            {data?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item)}
                className="w-full text-left flex gap-2.5 px-3.5 py-2.5 border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC]"
              >
                <span
                  aria-hidden
                  className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", item.level === "critical" ? "bg-[#DC2626]" : "bg-[#F59E0B]")}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium truncate">
                    <span className="font-mono text-[11.5px] text-[#475569]">{item.code}</span> {item.title}
                  </span>
                  <span className={cn("block text-[12px]", item.level === "critical" ? "text-[#DC2626]" : "text-[#B45309]")}>{item.status}</span>
                  <span className="block text-[11px] text-[#64748B] truncate">
                    {MODULE_LABEL[item.module]}
                    {item.customerName ? ` · ${item.customerName}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
