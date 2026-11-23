"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, Mail, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { HeaderAnalyticsBand } from "@/components/HeaderAnalyticsBand";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency, formatDateTime, formatShortDate } from "@/lib/utils";
import { inputClass } from "@/components/FormFields";

interface ReportData {
  summary: {
    totalCustomers: number;
    totalServices: number;
    monthlyRecurringUsd: number;
    pmCompliancePct: number;
    avgImpProgress: number;
    pocSuccessPct: number;
    totalPipelineUsd: number;
    closedPipelineUsd: number;
    alertsDispatched: number;
  };
  cmByStatus: Record<string, number>;
  cmBySeverity: Record<string, number>;
  pipelineByStage: Array<{ stage: string; count: number; valueUsd: number }>;
  expiringServices: Array<{
    id: number;
    serviceNumber: string;
    title: string;
    slaTier: string;
    monthlyFeeUsd: number;
    endDate: string;
  }>;
  recentAlerts: Array<{
    id: number;
    subject: string;
    status: string;
    deliveryMode: string;
    sentAt: string;
  }>;
}

export default function ReportsPage() {
  const { user, can } = useAuth();
  const { notify } = useToast();
  const [report, setReport] = useState<ReportData | null>(null);
  const [search, setSearch] = useState("");
  const [digestEmail, setDigestEmail] = useState("");
  const [sending, setSending] = useState(false);

  const loadReport = useCallback(async () => {
    const res = await fetch("/api/reports", { cache: "no-store" });
    if (res.ok) {
      setReport(await res.json());
    }
  }, []);

  useEffect(() => {
    if (user) {
      setDigestEmail(user.email);
      void loadReport();
    }
  }, [user, loadReport]);

  const handleSendDigest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!digestEmail.trim()) return;
    setSending(true);
    try {
      const recipients = digestEmail
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Failed to send report email", "error");
        return;
      }
      notify(`Executive digest ${data.dispatch.status} (${data.dispatch.deliveryMode})`);
      await loadReport();
    } finally {
      setSending(false);
    }
  };

  const s = report?.summary;

  return (
    <AppShell>
      <HeaderAnalyticsBand
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter expiring contracts or alert digests..."
        ctaLabel={can("reports:export") ? "Export CSV" : undefined}
        onCtaClick={() => {
          window.location.href = "/api/reports?format=csv&scope=all";
        }}
        barTitle="Reporting index"
        gaugePct={s?.pmCompliancePct ?? 85}
        gaugeLabel="PM compliance rate"
        kpi1Value={`${s?.avgImpProgress ?? 0}%`}
        kpi1Label="Avg rollout completion"
        kpi1Href="/implementations"
        kpi2Value={formatCurrency(s?.totalPipelineUsd ?? 0)}
        kpi2Label="Total pipeline volume"
        kpi2Href="/pipeline"
      />

      <div className="px-6 lg:px-8 py-6 space-y-6">
        {/* Export & Email Digest Strip */}
        <div className="rounded-[14px] border border-[#ECECE7] bg-[#FAF9F5] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[15.5px] font-semibold text-[#18181A]">
              Operational Reporting & Email Digest Dispatch
            </h2>
            <p className="text-[12.5px] text-[#78787E]">
              Download structured CSV exports or email a live operations summary to leadership.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can("reports:export") && (
              <>
                <a
                  href="/api/reports?format=csv&scope=all"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-[#E2E2DA] bg-white text-[12.5px] font-medium hover:bg-[#F4F4F1]"
                >
                  <Download className="w-3.5 h-3.5" /> Full CSV
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-[#E2E2DA] bg-white text-[12.5px] font-medium hover:bg-[#F4F4F1]"
                >
                  <Printer className="w-3.5 h-3.5" /> Print PDF
                </button>
              </>
            )}
          </div>
        </div>

        {can("reports:export") && (
          <form
            onSubmit={handleSendDigest}
            className="rounded-[14px] border border-[#ECECE7] bg-white p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#18181A] shrink-0">
              <Mail className="w-4 h-4" />
              <span>Email Report To:</span>
            </div>
            <input
              type="text"
              required
              value={digestEmail}
              onChange={(e) => setDigestEmail(e.target.value)}
              className={inputClass}
              placeholder="director@virtusms.io, ops@virtusms.io"
            />
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 rounded-[10px] bg-[#18181A] hover:bg-[#2C2C30] text-white text-[13px] font-medium shrink-0 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send Summary Email"}
            </button>
          </form>
        )}

        {/* Metrics Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Corrective Breakdown */}
          <div className="rounded-[14px] border border-[#ECECE7] bg-white p-5">
            <h3 className="text-[15px] font-semibold text-[#18181A] mb-3">
              Corrective Maintenance by Stage
            </h3>
            <div className="space-y-2.5 text-[13px]">
              {Object.entries(report?.cmByStatus ?? {}).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-[#525258]">{stage}</span>
                  <span className="font-semibold tabular-nums text-[#18181A]">{count}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-[#F1F1EC]">
              <div className="text-[12px] font-medium text-[#78787E] mb-2">By Severity</div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                {Object.entries(report?.cmBySeverity ?? {}).map(([sev, count]) => (
                  <div
                    key={sev}
                    className="rounded-lg bg-[#FAF9F5] px-2.5 py-1.5 flex items-center justify-between"
                  >
                    <span>{sev}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pipeline Breakdown */}
          <div className="rounded-[14px] border border-[#ECECE7] bg-white p-5">
            <h3 className="text-[15px] font-semibold text-[#18181A] mb-3">
              Pipeline Revenue Forecast
            </h3>
            <div className="space-y-3">
              {(report?.pipelineByStage ?? []).map((row) => (
                <div key={row.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[#525258]">
                      {row.stage} ({row.count})
                    </span>
                    <span className="font-semibold tabular-nums text-[#18181A]">
                      {formatCurrency(row.valueUsd)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F1F1EC] overflow-hidden">
                    <div
                      className="h-full bg-[#18181A] rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          s?.totalPipelineUsd
                            ? Math.round((row.valueUsd / s.totalPipelineUsd) * 100)
                            : 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* POC & Delivery KPIs */}
          <div className="rounded-[14px] border border-[#ECECE7] bg-[#19191B] text-white p-5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-400">
                Delivery & Contract Health
              </div>
              <div className="mt-4 space-y-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">POC Win Rate</span>
                  <span className="font-semibold tabular-nums">{s?.pocSuccessPct ?? 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Avg Implementation Progress</span>
                  <span className="font-semibold tabular-nums">{s?.avgImpProgress ?? 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Managed Service MRR</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(s?.monthlyRecurringUsd ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Alerts Dispatched</span>
                  <span className="font-semibold tabular-nums">{s?.alertsDispatched ?? 0}</span>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-white/10 text-[11.5px] text-zinc-400">
              All metrics queried directly from PostgreSQL tables.
            </div>
          </div>
        </div>

        {/* Expiring Service Numbers Table */}
        <div className="rounded-[14px] border border-[#ECECE7] bg-white p-5">
          <h3 className="text-[15px] font-semibold text-[#18181A] mb-3">
            Contracts Expiring Within 45 Days
          </h3>
          <div className="divide-y divide-[#F1F1EC]">
            {(report?.expiringServices ?? [])
              .filter((srv) =>
                `${srv.serviceNumber} ${srv.title}`.toLowerCase().includes(search.toLowerCase())
              )
              .map((srv) => (
                <div
                  key={srv.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-[13px]"
                >
                  <div>
                    <span className="font-mono text-[12px] text-[#78787E] mr-2">
                      {srv.serviceNumber}
                    </span>
                    <span className="font-medium text-[#18181A]">{srv.title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px]">
                    <span className="px-2 py-0.5 rounded bg-[#F4F4F1]">{srv.slaTier}</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(srv.monthlyFeeUsd)}/mo
                    </span>
                    <span className="text-amber-700 font-medium">
                      Ends {formatShortDate(srv.endDate)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Recent Alert Dispatch Audit */}
        <div className="rounded-[14px] border border-[#ECECE7] bg-white p-5">
          <h3 className="text-[15px] font-semibold text-[#18181A] mb-3">
            Alert Audit Trail
          </h3>
          <div className="divide-y divide-[#F1F1EC] text-[12.5px]">
            {(report?.recentAlerts ?? []).slice(0, 6).map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between gap-4">
                <span className="font-medium text-[#18181A] truncate">{a.subject}</span>
                <span className="text-[#78787E] shrink-0">
                  {a.status} · {a.deliveryMode} · {formatDateTime(a.sentAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
