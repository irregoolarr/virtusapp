"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, Mail, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { formatCurrency, formatDateTime, formatShortDate } from "@/lib/utils";
import { inputClass } from "@/components/FormFields";

interface ReportData {
  summary: {
    totalCustomers: number;
    totalServices: number;
    monthlyRecurringIdr: number;
    pmCompliancePct: number;
    avgImpProgress: number;
    pocSuccessPct: number;
    totalPipelineIdr: number;
    closedPipelineIdr: number;
    alertsDispatched: number;
  };
  cmByStatus: Record<string, number>;
  cmBySeverity: Record<string, number>;
  pipelineByStage: Array<{ stage: string; count: number; valueIdr: number }>;
  expiringServices: Array<{
    id: number;
    serviceNumber: string;
    title: string;
    slaTier: string;
    monthlyFeeIdr: number;
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

      <div className="p-3 sm:p-4 bg-[#EEF1F4] flex-1 space-y-4">
        <h1 className="text-[18px] font-semibold text-[#2B3036]">Reports</h1>
        <div className="space-y-4">
        {/* Export & Email Digest Strip */}
        <div className="rounded-sm border border-[#D9DEE3] bg-[#F6F7F8] p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[15.5px] font-semibold text-[#2B3036]">
              Operational Reporting & Email Digest Dispatch
            </h2>
            <p className="text-[12.5px] text-[#6B7280]">
              Download structured CSV exports or email a live operations summary to leadership.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can("reports:export") && (
              <>
                <a
                  href="/api/reports?format=csv&scope=all"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#C9D0D7] bg-white text-[12.5px] font-medium hover:bg-[#EEF1F4]"
                >
                  <Download className="w-3.5 h-3.5" /> Full CSV
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm border border-[#C9D0D7] bg-white text-[12.5px] font-medium hover:bg-[#EEF1F4]"
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
            className="rounded-sm border border-[#D9DEE3] bg-white p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#2B3036] shrink-0">
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
              className="px-4 py-2 rounded-sm bg-[#1668AC] hover:bg-[#0F4F86] text-white text-[13px] font-medium shrink-0 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send Summary Email"}
            </button>
          </form>
        )}

        {/* Metrics Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Corrective Breakdown */}
          <div className="rounded-sm border border-[#D9DEE3] bg-white p-5">
            <h3 className="text-[15px] font-semibold text-[#2B3036] mb-3">
              Corrective Maintenance by Stage
            </h3>
            <div className="space-y-2.5 text-[13px]">
              {Object.entries(report?.cmByStatus ?? {}).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-[#4B5563]">{stage}</span>
                  <span className="font-semibold tabular-nums text-[#2B3036]">{count}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-[#E9ECEF]">
              <div className="text-[12px] font-medium text-[#6B7280] mb-2">By Severity</div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                {Object.entries(report?.cmBySeverity ?? {}).map(([sev, count]) => (
                  <div
                    key={sev}
                    className="rounded-lg bg-[#F6F7F8] px-2.5 py-1.5 flex items-center justify-between"
                  >
                    <span>{sev}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pipeline Breakdown */}
          <div className="rounded-sm border border-[#D9DEE3] bg-white p-5">
            <h3 className="text-[15px] font-semibold text-[#2B3036] mb-3">
              Pipeline Revenue Forecast
            </h3>
            <div className="space-y-3">
              {(report?.pipelineByStage ?? []).map((row) => (
                <div key={row.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[#4B5563]">
                      {row.stage} ({row.count})
                    </span>
                    <span className="font-semibold tabular-nums text-[#2B3036]">
                      {formatCurrency(row.valueIdr)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#E9ECEF] overflow-hidden">
                    <div
                      className="h-full bg-[#1668AC] rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          s?.totalPipelineIdr
                            ? Math.round((row.valueIdr / s.totalPipelineIdr) * 100)
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
          <div className="rounded-sm border border-[#D9DEE3] bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="text-[15px] font-semibold text-[#2B3036]">
                Delivery &amp; Contract Health
              </div>
              <div className="mt-4 space-y-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">POC Win Rate</span>
                  <span className="font-semibold tabular-nums">{s?.pocSuccessPct ?? 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Avg Implementation Progress</span>
                  <span className="font-semibold tabular-nums">{s?.avgImpProgress ?? 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Managed Service MRR</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(s?.monthlyRecurringIdr ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#4B5563]">Alerts Dispatched</span>
                  <span className="font-semibold tabular-nums">{s?.alertsDispatched ?? 0}</span>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-[#E9ECEF] text-[11.5px] text-[#6B7280]">
              All metrics queried directly from PostgreSQL tables.
            </div>
          </div>
        </div>

        {/* Expiring Service Numbers Table */}
        <div className="rounded-sm border border-[#D9DEE3] bg-white p-5">
          <h3 className="text-[15px] font-semibold text-[#2B3036] mb-3">
            Contracts Expiring Within 45 Days
          </h3>
          <div className="divide-y divide-[#E9ECEF]">
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
                    <span className="tabular-nums text-[12px] text-[#6B7280] mr-2">
                      {srv.serviceNumber}
                    </span>
                    <span className="font-medium text-[#2B3036]">{srv.title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px]">
                    <span className="px-2 py-0.5 rounded bg-[#EEF1F4]">{srv.slaTier}</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(srv.monthlyFeeIdr)}/mo
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
        <div className="rounded-sm border border-[#D9DEE3] bg-white p-5">
          <h3 className="text-[15px] font-semibold text-[#2B3036] mb-3">
            Alert Audit Trail
          </h3>
          <div className="divide-y divide-[#E9ECEF] text-[12.5px]">
            {(report?.recentAlerts ?? []).slice(0, 6).map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between gap-4">
                <span className="font-medium text-[#2B3036] truncate">{a.subject}</span>
                <span className="text-[#6B7280] shrink-0">
                  {a.status} · {a.deliveryMode} · {formatDateTime(a.sentAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </AppShell>
  );
}
