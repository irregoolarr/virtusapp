import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import {
  correctiveMaintenances,
  customers,
  db,
  emailAlertLogs,
  implementations,
  pipelineDeals,
  pocRecords,
  preventiveMaintenances,
  serviceNumbers,
} from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { sendAlertEmail } from "@/lib/mailer";
import { escapeCsvCell } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth("reports:read");
  if ("error" in auth) return auth.error;

  const format = req.nextUrl.searchParams.get("format");
  const scope = req.nextUrl.searchParams.get("scope") ?? "all";

  const [cm, pm, imp, poc, deals, srv, cust, alertLogs] = await Promise.all([
    db.select().from(correctiveMaintenances).orderBy(desc(correctiveMaintenances.createdAt)),
    db.select().from(preventiveMaintenances).orderBy(desc(preventiveMaintenances.scheduledDate)),
    db.select().from(implementations).orderBy(desc(implementations.createdAt)),
    db.select().from(pocRecords).orderBy(desc(pocRecords.createdAt)),
    db.select().from(pipelineDeals).orderBy(desc(pipelineDeals.createdAt)),
    db.select().from(serviceNumbers).orderBy(serviceNumbers.endDate),
    db.select().from(customers),
    db.select().from(emailAlertLogs).orderBy(desc(emailAlertLogs.sentAt)).limit(25),
  ]);

  if (format === "csv") {
    if (!auth.user.permissions.includes("reports:export")) {
      return NextResponse.json({ error: "Missing permission: reports:export" }, { status: 403 });
    }

    const lines: string[] = [];
    if (scope === "corrective" || scope === "all") {
      lines.push("SECTION,CODE,TITLE,STATUS,SEVERITY_OR_TIER,VALUE_OR_PROGRESS,DATE");
      for (const r of cm) {
        lines.push(
          [
            "Corrective Maintenance",
            r.ticketCode,
            r.title,
            r.status,
            r.severity,
            r.rootCause ?? "",
            r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : "",
          ]
            .map(escapeCsvCell)
            .join(",")
        );
      }
    }
    if (scope === "preventive" || scope === "all") {
      for (const r of pm) {
        lines.push(
          [
            "Preventive Maintenance",
            r.planCode,
            r.title,
            r.status,
            r.frequency,
            `${r.checklist.filter((c) => c.done).length}/${r.checklist.length} checks`,
            new Date(r.scheduledDate).toISOString().slice(0, 10),
          ]
            .map(escapeCsvCell)
            .join(",")
        );
      }
    }
    if (scope === "services" || scope === "all") {
      for (const r of srv) {
        lines.push(
          [
            "Service Number",
            r.serviceNumber,
            r.title,
            r.status,
            r.slaTier,
            `$${r.monthlyFeeUsd}/mo`,
            new Date(r.endDate).toISOString().slice(0, 10),
          ]
            .map(escapeCsvCell)
            .join(",")
        );
      }
    }
    if (scope === "pipeline" || scope === "all") {
      for (const r of deals) {
        lines.push(
          [
            "Pipeline Deal",
            r.dealCode,
            r.title,
            r.stage,
            `${r.probabilityPct}%`,
            `$${r.dealValueUsd}`,
            r.expectedCloseDate ? new Date(r.expectedCloseDate).toISOString().slice(0, 10) : "",
          ]
            .map(escapeCsvCell)
            .join(",")
        );
      }
    }

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="virtusms-${scope}-report.csv"`,
      },
    });
  }

  const cmByStatus = {
    Reported: cm.filter((x) => x.status === "Reported").length,
    Diagnosing: cm.filter((x) => x.status === "Diagnosing").length,
    "In Repair": cm.filter((x) => x.status === "In Repair").length,
    Resolved: cm.filter((x) => x.status === "Resolved").length,
  };

  const cmBySeverity = {
    Critical: cm.filter((x) => x.severity === "Critical").length,
    High: cm.filter((x) => x.severity === "High").length,
    Medium: cm.filter((x) => x.severity === "Medium").length,
    Low: cm.filter((x) => x.severity === "Low").length,
  };

  const pmCompliancePct =
    pm.length > 0
      ? Math.round((pm.filter((p) => p.status === "Completed" || p.status === "Verification").length / pm.length) * 100)
      : 100;

  const avgImpProgress =
    imp.length > 0 ? Math.round(imp.reduce((s, i) => s + i.progressPct, 0) / imp.length) : 0;

  const pocSuccessPct =
    poc.length > 0
      ? Math.round((poc.filter((p) => p.outcome === "Success" || p.status === "Approved").length / poc.length) * 100)
      : 0;

  const pipelineByStage = ["Contacted", "Negotiation", "Offer Sent", "Deal Closed"].map((stage) => {
    const group = deals.filter((d) => d.stage === stage);
    return {
      stage,
      count: group.length,
      valueUsd: group.reduce((s, d) => s + d.dealValueUsd, 0),
    };
  });

  const expiringServices = srv.filter((s) => {
    const days = (new Date(s.endDate).getTime() - Date.now()) / 86400_000;
    return days <= 45;
  });

  return NextResponse.json({
    summary: {
      totalCustomers: cust.length,
      totalServices: srv.length,
      monthlyRecurringUsd: srv.reduce((s, x) => s + x.monthlyFeeUsd, 0),
      pmCompliancePct,
      avgImpProgress,
      pocSuccessPct,
      totalPipelineUsd: deals.reduce((s, d) => s + d.dealValueUsd, 0),
      closedPipelineUsd: deals.filter((d) => d.stage === "Deal Closed").reduce((s, d) => s + d.dealValueUsd, 0),
      alertsDispatched: alertLogs.length,
    },
    cmByStatus,
    cmBySeverity,
    pipelineByStage,
    expiringServices,
    recentAlerts: alertLogs,
  });
}

const emailReportSchema = z.object({
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(2).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("reports:export");
  if ("error" in auth) return auth.error;

  const parsed = emailReportSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide at least one valid recipient email" }, { status: 400 });
  }

  const [cm, pm, deals, srv] = await Promise.all([
    db.select().from(correctiveMaintenances),
    db.select().from(preventiveMaintenances),
    db.select().from(pipelineDeals),
    db.select().from(serviceNumbers),
  ]);

  const openCm = cm.filter((c) => c.status !== "Resolved").length;
  const completedPm = pm.filter((p) => p.status === "Completed").length;
  const closedDealsUsd = deals
    .filter((d) => d.stage === "Deal Closed")
    .reduce((s, d) => s + d.dealValueUsd, 0);
  const mrrUsd = srv.reduce((s, x) => s + x.monthlyFeeUsd, 0);

  const reportBody = [
    `VirtusMS Executive Service Operations Digest`,
    `Generated by: ${auth.user.name} (${auth.user.roleName})`,
    `Timestamp: ${new Date().toISOString()}`,
    ``,
    `1. Corrective Maintenance: ${openCm} open / ${cm.length} total tickets`,
    `2. Preventive Maintenance: ${completedPm} completed / ${pm.length} plans`,
    `3. Active Service Numbers: ${srv.length} contracts ($${mrrUsd.toLocaleString()} MRR)`,
    `4. Closed Pipeline Value: $${closedDealsUsd.toLocaleString()}`,
  ].join("\n");

  const dispatch = await sendAlertEmail({
    recipients: parsed.data.recipients,
    subject: parsed.data.subject ?? `[VirtusMS Report] Service Operations Summary`,
    body: reportBody,
  });

  return NextResponse.json({ dispatch });
}
