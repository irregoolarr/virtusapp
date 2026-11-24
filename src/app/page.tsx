"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, DollarSign, Layers, MailCheck, Plus, Wrench } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartCard, EmptyChart } from "@/components/dashboard/ChartCard";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { GroupedBarChart, StackedBarChart } from "@/components/dashboard/BarCharts";
import { SERIES, compactNumber } from "@/components/dashboard/chartUtils";
import { cn, formatCurrency, formatDateTime, formatShortDate } from "@/lib/utils";

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

  return (
    <AppShell>
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[#0F172A]">Operations Dashboard</h1>
            <p className="mt-0.5 text-[13px] text-[#64748B]">
              Maintenance, delivery and commercial health across the Management Service Team
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex flex-col rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 min-w-[150px]">
              <span className="text-[10.5px] text-[#64748B]">Workload window</span>
              <select
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
                className="bg-transparent text-[13px] font-medium text-[#0F172A] focus:outline-none cursor-pointer"
              >
                <option value={4}>Next 4 weeks</option>
                <option value={8}>Next 8 weeks</option>
                <option value={12}>Next 12 weeks</option>
              </select>
            </label>
            {can("maintenance:write") && (
              <Link
                href="/corrective?new=1"
                className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-[#FF2224] hover:bg-[#E01B1D] text-white text-[13.5px] font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Log Incident
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#E2E8F0] flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "relative px-4 sm:px-6 py-3 text-[14px] whitespace-nowrap transition-colors",
                tab === t ? "text-[#1D4ED8] font-medium" : "text-[#475569] hover:text-[#0F172A]"
              )}
            >
              {t}
              {tab === t && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#1D4ED8] rounded-full" />}
            </button>
          ))}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            href="/corrective"
            icon={Wrench}
            value={m?.openCorrective ?? 0}
            label="Open incidents"
            note={m && m.criticalOpen > 0 ? `${m.criticalOpen} critical` : undefined}
            tone={m && m.criticalOpen > 0 ? "bad" : "neutral"}
          />
          <KpiCard
            href="/preventive"
            icon={CalendarCheck2}
            value={m?.activePm ?? 0}
            label="Active PM plans"
            note={m ? `${m.completedPm} done` : undefined}
            tone="good"
          />
          <KpiCard
            href="/implementations"
            icon={Layers}
            value={(m?.activeImplementations ?? 0) + (m?.activePocs ?? 0)}
            label="Rollouts & POCs"
            note={m ? `${m.approvedPocs} won` : undefined}
            tone="good"
          />
          <KpiCard
            href="/services"
            icon={DollarSign}
            value={formatCurrency(m?.monthlyRecurringUsd ?? 0)}
            label="Monthly recurring"
            note={m && m.expiringServices > 0 ? `${m.expiringServices} expiring` : undefined}
            tone={m && m.expiringServices > 0 ? "warn" : "neutral"}
          />
        </div>

        {tab === "Overview" && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ChartCard
                title="Pipeline by stage"
                subtitle={`${formatCurrency(pipelineTotal)} total deal value · ${formatCurrency(m?.closedDealValue ?? 0)} closed`}
                href="/pipeline"
                hrefLabel="Open pipeline"
              >
                {pipelineTotal > 0 ? (
                  <DonutChart slices={pipelineSlices} centerLabel="Total pipeline" formatValue={usd} />
                ) : (
                  <EmptyChart message="No pipeline deals yet" />
                )}
              </ChartCard>

              <ChartCard
                title="Incidents by customer"
                subtitle={`${totalIncidents} corrective tickets · ${m?.openCorrective ?? 0} open`}
                href="/corrective"
                hrefLabel="Open corrective board"
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

            <ChartCard
              title="Upcoming workload"
              subtitle={`${workloadTotal} scheduled items over the next ${weeks} weeks, by week`}
              href="/events"
              hrefLabel="Open events"
            >
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ListCard title="Active corrective incidents" href="/corrective" linkLabel="Open board">
              {(data?.recentCorrective ?? []).map((cm) => (
                <Row
                  key={cm.id}
                  code={cm.ticketCode}
                  title={cm.title}
                  tag={cm.severity}
                  tagTone={cm.severity === "Critical" ? "bad" : cm.severity === "High" ? "warn" : "neutral"}
                  right={cm.status}
                  sub={`Due ${formatShortDate(cm.dueDate)}`}
                />
              ))}
            </ListCard>
            <ListCard title="Upcoming preventive maintenance" href="/preventive" linkLabel="Open schedule">
              {(data?.upcomingPm ?? []).map((pm) => (
                <Row
                  key={pm.id}
                  code={pm.planCode}
                  title={pm.title}
                  tag={pm.frequency}
                  right={pm.status}
                  sub={formatShortDate(pm.scheduledDate)}
                />
              ))}
            </ListCard>
          </div>
        )}

        {tab === "Alerts & Reminders" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ListCard title={`Scheduled reminders (${m?.scheduledEvents ?? 0})`} href="/events" linkLabel="Manage">
              {(data?.upcomingEvents ?? []).map((ev) => (
                <Row
                  key={ev.id}
                  code={ev.eventCode}
                  title={ev.title}
                  tag={ev.eventType}
                  right={ev.status}
                  sub={`${ev.recurrence} · ${formatDateTime(ev.nextRunAt)}`}
                />
              ))}
            </ListCard>
            <ListCard title="Recent email alerts" href="/events" linkLabel="Outbox" icon={MailCheck}>
              {(data?.recentAlerts ?? []).map((log) => (
                <Row
                  key={log.id}
                  title={log.subject}
                  tag={log.deliveryMode}
                  right={log.status}
                  rightTone={log.status === "Failed" ? "bad" : "neutral"}
                  sub={formatDateTime(log.sentAt)}
                />
              ))}
            </ListCard>
          </div>
        )}
      </div>
    </AppShell>
  );
}

type Tone = "bad" | "warn" | "neutral";
const TAG_TONE: Record<Tone, string> = {
  bad: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  warn: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
  neutral: "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]",
};

function ListCard({
  title,
  href,
  linkLabel,
  icon: Icon,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const empty = React.Children.count(children) === 0;
  return (
    <section className="rounded-md border border-[#E2E8F0] bg-white">
      <header className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#0F172A]">
          {Icon && <Icon className="w-4 h-4 text-[#64748B]" />}
          {title}
        </h2>
        <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#1D4ED8] hover:underline">
          {linkLabel} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>
      <div className="divide-y divide-[#F1F5F9]">
        {empty ? <div className="px-5 py-8 text-center text-[12.5px] text-[#64748B]">Nothing here yet</div> : children}
      </div>
    </section>
  );
}

function Row({
  code,
  title,
  tag,
  tagTone = "neutral",
  right,
  rightTone = "neutral",
  sub,
}: {
  code?: string;
  title: string;
  tag?: string;
  tagTone?: Tone;
  right: string;
  rightTone?: Tone;
  sub?: string;
}) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {code && <span className="font-mono text-[11px] text-[#64748B]">{code}</span>}
          {tag && <span className={cn("text-[10.5px] font-medium px-2 py-0.5 rounded border", TAG_TONE[tagTone])}>{tag}</span>}
        </div>
        <div className="mt-0.5 text-[13.5px] font-medium text-[#0F172A] truncate">{title}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn("text-[12.5px] font-medium", rightTone === "bad" ? "text-[#B91C1C]" : "text-[#0F172A]")}>{right}</div>
        {sub && <div className="text-[11px] text-[#64748B]">{sub}</div>}
      </div>
    </div>
  );
}
