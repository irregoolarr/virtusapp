"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Compass,
  Hash,
  Layers,
  MailCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
import { WeeklyBarPoint } from "@/components/WeeklyBarsChart";
import { cn, formatCurrency, formatDateTime, formatShortDate } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";

interface DashboardPayload {
  metrics: {
    openCorrective: number;
    resolvedCorrective: number;
    criticalOpen: number;
    activePm: number;
    completedPm: number;
    activeImplementations: number;
    activePocs: number;
    approvedPocs: number;
    closedDealValue: number;
    openPipelineValue: number;
    activeServices: number;
    expiringServices: number;
    monthlyRecurringUsd: number;
    totalCustomers: number;
    totalPartners: number;
    totalProducts: number;
    scheduledEvents: number;
    healthRatePct: number;
    totalOpenTasks: number;
  };
  weeklyOps: WeeklyBarPoint[];
  recentCorrective: Array<{
    id: number;
    ticketCode: string;
    title: string;
    severity: string;
    status: string;
    dueDate: string | null;
  }>;
  upcomingPm: Array<{
    id: number;
    planCode: string;
    title: string;
    frequency: string;
    status: string;
    scheduledDate: string;
  }>;
  upcomingEvents: Array<{
    id: number;
    eventCode: string;
    title: string;
    eventType: string;
    nextRunAt: string;
    status: string;
    recurrence: string;
  }>;
  recentAlerts: Array<{
    id: number;
    subject: string;
    deliveryMode: string;
    status: string;
    sentAt: string;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    if (res.ok) {
      setData(await res.json());
    }
  }, []);

  useEffect(() => {
    if (user) void loadDashboard();
  }, [user, loadDashboard]);

  const m = data?.metrics;

  const filteredCorrective = (data?.recentCorrective ?? []).filter((c) =>
    `${c.ticketCode} ${c.title} ${c.status}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPm = (data?.upcomingPm ?? []).filter((p) =>
    `${p.planCode} ${p.title} ${p.frequency}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search incidents, PM plans, events..."
        onlyMine={onlyMine}
        onToggleOnlyMine={() => setOnlyMine((v) => !v)}
        barTitle="Weekly operations"
        weeklyData={data?.weeklyOps}
        gaugePct={m?.healthRatePct ?? 78}
        gaugeLabel="SLA & delivery health"
        kpi1Value={m?.totalOpenTasks ?? 0}
        kpi1Label="Active ops & tasks"
        kpi1Href="/corrective"
        kpi2Value={formatCurrency(m?.monthlyRecurringUsd ?? 0)}
        kpi2Label="Managed monthly recurring"
        kpi2Href="/services"
      />

      <div className="px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Module Pulse Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/corrective"
            className="rounded-[14px] border border-[#ECECE7] bg-white p-4 hover:border-[#D0D0C8] transition-all"
          >
            <div className="flex items-center justify-between text-[#78787E]">
              <span className="text-[12px] font-medium">Corrective Maintenance</span>
              <Wrench className="w-4 h-4" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-[26px] font-semibold tabular-nums text-[#18181A]">
                {m?.openCorrective ?? 0}
              </span>
              {(m?.criticalOpen ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle className="w-3 h-3" />
                  {m?.criticalOpen} critical
                </span>
              )}
            </div>
            <div className="mt-1 text-[11.5px] text-[#8E8E93]">
              {m?.resolvedCorrective ?? 0} resolved tickets
            </div>
          </Link>

          <Link
            href="/preventive"
            className="rounded-[14px] border border-[#ECECE7] bg-white p-4 hover:border-[#D0D0C8] transition-all"
          >
            <div className="flex items-center justify-between text-[#78787E]">
              <span className="text-[12px] font-medium">Preventive Plans</span>
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-[26px] font-semibold tabular-nums text-[#18181A]">
                {m?.activePm ?? 0}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F4F4F1] text-[#525258]">
                {m?.completedPm ?? 0} completed
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-[#8E8E93]">
              Scheduled & verification windows
            </div>
          </Link>

          <Link
            href="/implementations"
            className="rounded-[14px] border border-[#ECECE7] bg-white p-4 hover:border-[#D0D0C8] transition-all"
          >
            <div className="flex items-center justify-between text-[#78787E]">
              <span className="text-[12px] font-medium">Implementations & POCs</span>
              <Layers className="w-4 h-4" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-[26px] font-semibold tabular-nums text-[#18181A]">
                {(m?.activeImplementations ?? 0) + (m?.activePocs ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F4F4F1] text-[#525258]">
                <Compass className="w-3 h-3" />
                {m?.approvedPocs ?? 0} POC won
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-[#8E8E93]">
              {m?.activeImplementations ?? 0} rollouts · {m?.activePocs ?? 0} active POCs
            </div>
          </Link>

          <Link
            href="/services"
            className="rounded-[14px] border border-[#ECECE7] bg-[#19191B] text-white p-4 shadow-sm hover:bg-[#232327] transition-all"
          >
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[12px] font-medium">Service Numbers & Deals</span>
              <Hash className="w-4 h-4" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-[26px] font-semibold tabular-nums">
                {m?.activeServices ?? 0}
              </span>
              {(m?.expiringServices ?? 0) > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                  {m?.expiringServices} expiring &lt;30d
                </span>
              )}
            </div>
            <div className="mt-1 text-[11.5px] text-zinc-400 flex items-center justify-between">
              <span>Pipeline won: {formatCurrency(m?.closedDealValue ?? 0)}</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </Link>
        </div>

        {/* Operational Workstreams Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: Corrective + Preventive queues */}
          <div className="xl:col-span-7 space-y-6">
            <div className="rounded-[14px] border border-[#ECECE7] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#18181A]">
                    Active Corrective Incidents
                  </h2>
                  <p className="text-[12px] text-[#78787E]">
                    Break-fix & SLA escalations across managed customer circuits
                  </p>
                </div>
                <Link
                  href="/corrective"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#18181A] hover:underline"
                >
                  Open board <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="divide-y divide-[#F1F1EC]">
                {filteredCorrective.map((cm) => (
                  <div key={cm.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[#8E8E93]">{cm.ticketCode}</span>
                        <span
                          className={cn(
                            "text-[10.5px] font-medium px-2 py-0.5 rounded-full",
                            cm.severity === "Critical"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : cm.severity === "High"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-[#F4F4F1] text-[#525258]"
                          )}
                        >
                          {cm.severity}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[13.5px] font-medium text-[#18181A] truncate">
                        {cm.title}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-medium text-[#18181A]">{cm.status}</div>
                      <div className="text-[11px] text-[#8E8E93]">{formatShortDate(cm.dueDate)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[14px] border border-[#ECECE7] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#18181A]">
                    Upcoming Preventive Maintenance
                  </h2>
                  <p className="text-[12px] text-[#78787E]">
                    Recurring inspection & patch windows
                  </p>
                </div>
                <Link
                  href="/preventive"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#18181A] hover:underline"
                >
                  Open schedule <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="divide-y divide-[#F1F1EC]">
                {filteredPm.map((pm) => (
                  <div key={pm.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[#8E8E93]">{pm.planCode}</span>
                        <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-[#F4F4F1] text-[#525258]">
                          {pm.frequency}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[13.5px] font-medium text-[#18181A] truncate">
                        {pm.title}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-medium text-[#18181A]">{pm.status}</div>
                      <div className="text-[11px] text-[#8E8E93]">
                        {formatShortDate(pm.scheduledDate)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Scheduled Reminder Events & Recent Alert Outbox */}
          <div className="xl:col-span-5 space-y-6">
            <div className="rounded-[14px] border border-[#ECECE7] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-[#18181A]" />
                  <h2 className="text-[16px] font-semibold text-[#18181A]">
                    Scheduled Event Reminders
                  </h2>
                </div>
                <Link
                  href="/events"
                  className="text-[12.5px] font-medium text-[#18181A] hover:underline"
                >
                  Manage ({m?.scheduledEvents ?? 0})
                </Link>
              </div>
              <div className="space-y-3">
                {(data?.upcomingEvents ?? []).map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-[#ECECE7] bg-[#FAF9F5] p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-[#78787E]">{ev.eventCode}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white border border-[#E5E5DF] text-[#525258]">
                          {ev.eventType}
                        </span>
                        <span className="text-[#8E8E93]">{ev.recurrence}</span>
                      </div>
                      <div className="mt-1 text-[13px] font-medium text-[#18181A] truncate">
                        {ev.title}
                      </div>
                      <div className="mt-1 text-[11px] text-[#78787E]">
                        Next trigger: {formatDateTime(ev.nextRunAt)}
                      </div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#18181A] text-white shrink-0">
                      {ev.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[14px] border border-[#ECECE7] bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MailCheck className="w-4 h-4 text-[#18181A]" />
                  <h2 className="text-[15px] font-semibold text-[#18181A]">
                    Recent Email Alert Dispatches
                  </h2>
                </div>
                <Link href="/events" className="text-[12px] text-[#78787E] hover:text-[#18181A]">
                  Outbox
                </Link>
              </div>
              <div className="space-y-2.5">
                {(data?.recentAlerts ?? []).map((log) => (
                  <div key={log.id} className="text-[12px] border-b border-[#F2F2ED] pb-2.5 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#18181A] truncate">{log.subject}</span>
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#F4F4F1] text-[#525258] shrink-0">
                        {log.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#8E8E93]">
                      {log.deliveryMode} · {formatDateTime(log.sentAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
