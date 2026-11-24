"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { KpiStrip } from "@/components/dashboard/KpiCard";
import { DataGrid, GridPage, GridSelect, GridTabs, type GridColumn } from "@/components/grid/DataGrid";
import { Mono, Pill, severityTone } from "@/components/grid/cells";
import { ChartCard, EmptyChart } from "@/components/dashboard/ChartCard";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { GroupedBarChart, StackedBarChart } from "@/components/dashboard/BarCharts";
import { SERIES, compactNumber } from "@/components/dashboard/chartUtils";
import { formatCurrency, formatDateTime, formatShortDate } from "@/lib/utils";

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
    scheduledEvents: number;
  };
  pipelineByStage: Array<{ stage: string; count: number; value: number }>;
  incidentsByCustomer: Array<{ customer: string; total: number; open: number }>;
  upcomingWorkload: Array<{ weekStart: string; preventive: number; corrective: number; reminders: number }>;
  recentCorrective: Array<{ id: number; ticketCode: string; title: string; severity: string; status: string; dueDate: string | null }>;
  upcomingPm: Array<{ id: number; planCode: string; title: string; frequency: string; status: string; scheduledDate: string }>;
  upcomingEvents: Array<{ id: number; eventCode: string; title: string; eventType: string; nextRunAt: string; status: string; recurrence: string }>;
  recentAlerts: Array<{ id: number; subject: string; deliveryMode: string; status: string; sentAt: string }>;
}

const TABS = ["Overview", "Maintenance", "Alerts & Reminders"] as const;
type Tab = (typeof TABS)[number];

const STAGE_COLORS = [SERIES.blue, SERIES.orange, SERIES.aqua, SERIES.yellow];

const usd = (n: number) => `$${compactNumber(n)}`;

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [weeks, setWeeks] = useState(8);

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    if (user) void loadDashboard();
  }, [user, loadDashboard]);

  const m = data?.metrics;

  const pipelineSlices = useMemo(
    () =>
      (data?.pipelineByStage ?? []).map((s, i) => ({
        label: s.stage,
        value: s.value,
        color: STAGE_COLORS[i % STAGE_COLORS.length],
        meta: `${s.count} deal${s.count === 1 ? "" : "s"}`,
      })),
    [data]
  );
  const pipelineTotal = pipelineSlices.reduce((s, x) => s + x.value, 0);

  const incidentRows = useMemo(
    () =>
      (data?.incidentsByCustomer ?? []).map((c) => ({
        label: c.customer,
        open: c.open,
        resolved: c.total - c.open,
      })),
    [data]
  );
  const totalIncidents = (data?.incidentsByCustomer ?? []).reduce((s, c) => s + c.total, 0);

  const workloadRows = useMemo(
    () =>
      (data?.upcomingWorkload ?? []).slice(0, weeks).map((w) => ({
        label: formatShortDate(w.weekStart),
        preventive: w.preventive,
        corrective: w.corrective,
        reminders: w.reminders,
      })),
    [data, weeks]
  );
  const workloadTotal = workloadRows.reduce((s, r) => s + r.preventive + r.corrective + r.reminders, 0);

  const incidentCols: GridColumn<DashboardPayload["recentCorrective"][number]>[] = [
    { key: "ticketCode", header: "Incident", width: 120, render: (r) => <Mono>{r.ticketCode}</Mono> },
    { key: "severity", header: "Priority", width: 100, render: (r) => <Pill tone={severityTone(r.severity)}>{r.severity}</Pill> },
    { key: "title", header: "Summary", width: 260, wrap: true },
    { key: "status", header: "Status", width: 110 },
    { key: "dueDate", header: "SLA Due", width: 100, value: (r) => r.dueDate ?? "", render: (r) => formatShortDate(r.dueDate) },
  ];
  const pmCols: GridColumn<DashboardPayload["upcomingPm"][number]>[] = [
    { key: "planCode", header: "Plan", width: 120, render: (r) => <Mono>{r.planCode}</Mono> },
    { key: "frequency", header: "Frequency", width: 110 },
    { key: "title", header: "Summary", width: 260, wrap: true },
    { key: "status", header: "Status", width: 110 },
    { key: "scheduledDate", header: "Scheduled", width: 100, render: (r) => formatShortDate(r.scheduledDate) },
  ];
  const eventCols: GridColumn<DashboardPayload["upcomingEvents"][number]>[] = [
    { key: "eventCode", header: "Event", width: 110, render: (r) => <Mono>{r.eventCode}</Mono> },
    { key: "title", header: "Summary", width: 240, wrap: true },
    { key: "recurrence", header: "Recurrence", width: 100 },
    { key: "nextRunAt", header: "Next Run", width: 160, render: (r) => formatDateTime(r.nextRunAt) },
  ];
  const alertCols: GridColumn<DashboardPayload["recentAlerts"][number]>[] = [
    { key: "sentAt", header: "Sent On", width: 160, render: (r) => formatDateTime(r.sentAt) },
    { key: "subject", header: "Subject", width: 260, wrap: true },
    { key: "deliveryMode", header: "Delivery", width: 90 },
    { key: "status", header: "Status", width: 90 },
  ];

  const toolbarBtn = "h-8 px-2 text-[12.5px] font-semibold uppercase tracking-[0.02em] text-[#1668AC] hover:text-[#0F4F86]";

  return (
    <AppShell>
      <GridPage>
        <section className="bg-white border border-[#D9DEE3]">
          <div className="px-4 pt-3">
            <h1 className="text-[16px] font-semibold text-[#2B3036]">Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5">
            <div className="flex items-center">
              {can("maintenance:read") && (
                <Link href="/corrective" className={`${toolbarBtn} inline-flex items-center`}>
                  Incidents
                </Link>
              )}
              {can("reports:read") && (
                <Link href="/reports" className={`${toolbarBtn} inline-flex items-center`}>
                  Reports
                </Link>
              )}
              <button type="button" onClick={() => void loadDashboard()} title="Refresh" aria-label="Refresh" className="h-8 w-8 flex items-center justify-center text-[#1668AC] hover:text-[#0F4F86]">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <GridSelect
              label="Workload window"
              value={String(weeks)}
              onChange={(v) => setWeeks(Number(v))}
              options={[
                { value: "4", label: "Next 4 weeks" },
                { value: "8", label: "Next 8 weeks" },
                { value: "12", label: "Next 12 weeks" },
              ]}
            />
          </div>
        </section>

        <KpiStrip
          items={[
            {
              label: "Open incidents",
              value: m?.openCorrective ?? 0,
              note: m && m.criticalOpen > 0 ? `${m.criticalOpen} critical` : `${m?.resolvedCorrective ?? 0} resolved`,
              tone: m && m.criticalOpen > 0 ? "bad" : "neutral",
              href: "/corrective",
            },
            { label: "Active PM plans", value: m?.activePm ?? 0, note: `${m?.completedPm ?? 0} completed`, href: "/preventive" },
            {
              label: "Rollouts & POCs",
              value: (m?.activeImplementations ?? 0) + (m?.activePocs ?? 0),
              note: `${m?.activeImplementations ?? 0} rollouts · ${m?.activePocs ?? 0} POCs`,
              href: "/implementations",
            },
            {
              label: "Monthly recurring",
              value: formatCurrency(m?.monthlyRecurringUsd ?? 0),
              note: m && m.expiringServices > 0 ? `${m.expiringServices} contracts expiring in 30 days` : `${m?.activeServices ?? 0} active services`,
              tone: m && m.expiringServices > 0 ? "warn" : "neutral",
              href: "/services",
            },
          ]}
        />

        <GridTabs tabs={TABS.map((t) => ({ key: t, label: t }))} value={tab} onChange={setTab} />

        {tab === "Overview" && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ChartCard
                title="Pipeline by stage"
                subtitle={`${formatCurrency(pipelineTotal)} total · ${formatCurrency(m?.closedDealValue ?? 0)} closed`}
                href="/pipeline"
              >
                {pipelineTotal > 0 ? (
                  <DonutChart slices={pipelineSlices} centerLabel="Total pipeline" formatValue={usd} />
                ) : (
                  <EmptyChart message="No pipeline deals yet" />
                )}
              </ChartCard>

              <ChartCard
                title="Incidents by customer"
                subtitle={`${totalIncidents} tickets · ${m?.openCorrective ?? 0} open`}
                href="/corrective"
              >
                {incidentRows.length > 0 ? (
                  <StackedBarChart
                    rows={incidentRows}
                    series={[
                      { key: "open", label: "Open", color: SERIES.orange },
                      { key: "resolved", label: "Resolved", color: SERIES.blue },
                    ]}
                  />
                ) : (
                  <EmptyChart message="No corrective tickets yet" />
                )}
              </ChartCard>
            </div>

            <ChartCard title="Upcoming workload" subtitle={`${workloadTotal} scheduled items, next ${weeks} weeks`} href="/events">
              {workloadRows.length > 0 ? (
                <GroupedBarChart
                  rows={workloadRows}
                  series={[
                    { key: "preventive", label: "Preventive visits", color: SERIES.blue },
                    { key: "corrective", label: "Incident SLA due", color: SERIES.orange },
                    { key: "reminders", label: "Reminders", color: SERIES.aqua },
                  ]}
                />
              ) : (
                <EmptyChart message="Nothing scheduled" />
              )}
            </ChartCard>
          </>
        )}

        {tab === "Maintenance" && (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <ChartCard title="Open incidents" flush href="/corrective">
              <DataGrid embedded columns={incidentCols} rows={data?.recentCorrective ?? []} getRowId={(r) => r.id} rowTone={(r) => (r.severity === "Critical" ? "critical" : undefined)} />
            </ChartCard>
            <ChartCard title="Upcoming preventive maintenance" flush href="/preventive">
              <DataGrid embedded columns={pmCols} rows={data?.upcomingPm ?? []} getRowId={(r) => r.id} />
            </ChartCard>
          </div>
        )}

        {tab === "Alerts & Reminders" && (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <ChartCard flush title={`Scheduled reminders (${m?.scheduledEvents ?? 0})`} href="/events">
              <DataGrid embedded columns={eventCols} rows={data?.upcomingEvents ?? []} getRowId={(r) => r.id} />
            </ChartCard>
            <ChartCard title="Recent email alerts" flush href="/events">
              <DataGrid embedded columns={alertCols} rows={data?.recentAlerts ?? []} getRowId={(r) => r.id} rowTone={(r) => (r.status === "Failed" ? "critical" : undefined)} />
            </ChartCard>
          </div>
        )}
      </GridPage>
    </AppShell>
  );
}
