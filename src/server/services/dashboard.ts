import { isCorrectiveDone } from "@/shared/constants";
import { desc } from "drizzle-orm";
import {
  businessPartners,
  correctiveMaintenances,
  customers,
  db,
  emailAlertLogs,
  events,
  implementations,
  pipelineDeals,
  pocRecords,
  preventiveMaintenances,
  products,
  serviceNumbers,
} from "@/db";
import { serialize } from "@/server/http";

/** Everything the dashboard page needs in one round trip. */
export async function getDashboard() {

  const [
    cmRows,
    pmRows,
    impRows,
    pocRows,
    dealRows,
    srvRows,
    custRows,
    partnerRows,
    productRows,
    eventRows,
    alertLogs,
  ] = await Promise.all([
    db.select().from(correctiveMaintenances).orderBy(desc(correctiveMaintenances.createdAt)),
    db.select().from(preventiveMaintenances).orderBy(desc(preventiveMaintenances.createdAt)),
    db.select().from(implementations).orderBy(desc(implementations.createdAt)),
    db.select().from(pocRecords).orderBy(desc(pocRecords.createdAt)),
    db.select().from(pipelineDeals).orderBy(desc(pipelineDeals.createdAt)),
    db.select().from(serviceNumbers),
    db.select().from(customers),
    db.select().from(businessPartners),
    db.select().from(products),
    db.select().from(events).orderBy(events.nextRunAt),
    db.select().from(emailAlertLogs).orderBy(desc(emailAlertLogs.sentAt)).limit(6),
  ]);

  const openCorrective = cmRows.filter((c) => !isCorrectiveDone(c.status)).length;
  const resolvedCorrective = cmRows.filter((c) => isCorrectiveDone(c.status)).length;
  const criticalOpen = cmRows.filter((c) => !isCorrectiveDone(c.status) && c.severity === "Critical").length;

  const activePm = pmRows.filter((p) => p.status !== "Completed").length;
  const completedPm = pmRows.filter((p) => p.status === "Completed").length;

  const activeImplementations = impRows.filter((i) => i.status !== "Go-Live").length;
  const activePocs = pocRows.filter((p) => p.status !== "Approved").length;
  const approvedPocs = pocRows.filter((p) => p.status === "Approved").length;

  const closedDealValue = dealRows
    .filter((d) => d.stage === "Deal Closed")
    .reduce((sum, d) => sum + d.dealValueIdr, 0);
  const openPipelineValue = dealRows
    .filter((d) => d.stage !== "Deal Closed")
    .reduce((sum, d) => sum + d.dealValueIdr, 0);

  const activeServices = srvRows.filter((s) => s.status === "Active").length;
  const expiringServices = srvRows.filter((s) => {
    const diffDays = (new Date(s.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30 && diffDays >= 0;
  }).length;
  const monthlyRecurringIdr = srvRows
    .filter((s) => s.status !== "Expired" && s.status !== "Suspended")
    .reduce((sum, s) => sum + s.monthlyFeeIdr, 0);

  const totalOpsCompleted = resolvedCorrective + completedPm + approvedPocs;
  const totalOpsAll = cmRows.length + pmRows.length + pocRows.length;
  const healthRatePct =
    totalOpsAll > 0 ? Math.round(((totalOpsAll - openCorrective) / totalOpsAll) * 100) : 92;

  // Pipeline value by stage (fixed stage order)
  const PIPELINE_STAGES = ["Contacted", "Negotiation", "Offer Sent", "Deal Closed"];
  const pipelineByStage = PIPELINE_STAGES.map((stage) => {
    const rows = dealRows.filter((d) => d.stage === stage);
    return {
      stage,
      count: rows.length,
      value: rows.reduce((sum, d) => sum + d.dealValueIdr, 0),
    };
  });

  // Corrective incidents per customer (top 6 by volume)
  const customerName = new Map(custRows.map((c) => [c.id, c.name]));
  const incidentMap = new Map<string, { customer: string; total: number; open: number }>();
  for (const c of cmRows) {
    const name = (c.customerId && customerName.get(c.customerId)) || "Unassigned";
    const entry = incidentMap.get(name) ?? { customer: name, total: 0, open: 0 };
    entry.total += 1;
    if (!isCorrectiveDone(c.status)) entry.open += 1;
    incidentMap.set(name, entry);
  }
  const incidentsByCustomer = [...incidentMap.values()]
    .sort((a, b) => b.total - a.total || a.customer.localeCompare(b.customer))
    .slice(0, 6);

  // Upcoming workload: next 12 weeks, bucketed by week (Monday start)
  const WEEKS = 12;
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const upcomingWorkload = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(weekStart.getTime() + i * 7 * 86_400_000);
    return { weekStart: start.toISOString(), preventive: 0, corrective: 0, reminders: 0 };
  });
  const bucket = (date: Date | string | null | undefined): number => {
    if (!date) return -1;
    const t = new Date(date).getTime();
    const idx = Math.floor((t - weekStart.getTime()) / (7 * 86_400_000));
    return idx >= 0 && idx < WEEKS ? idx : -1;
  };
  for (const p of pmRows) {
    if (p.status === "Completed") continue;
    const i = bucket(p.scheduledDate);
    if (i >= 0) upcomingWorkload[i].preventive += 1;
  }
  for (const c of cmRows) {
    if (isCorrectiveDone(c.status)) continue;
    const i = bucket(c.dueDate);
    if (i >= 0) upcomingWorkload[i].corrective += 1;
  }
  for (const e of eventRows) {
    if (e.status !== "Scheduled") continue;
    const i = bucket(e.nextRunAt);
    if (i >= 0) upcomingWorkload[i].reminders += 1;
  }

  const scheduledEvents = eventRows.filter((e) => e.status === "Scheduled").length;

  return serialize({
    metrics: {
      openCorrective,
      resolvedCorrective,
      criticalOpen,
      activePm,
      completedPm,
      activeImplementations,
      activePocs,
      approvedPocs,
      closedDealValue,
      openPipelineValue,
      activeServices,
      expiringServices,
      monthlyRecurringIdr,
      totalCustomers: custRows.length,
      totalPartners: partnerRows.length,
      totalProducts: productRows.length,
      scheduledEvents,
      healthRatePct,
      totalOpenTasks: openCorrective + activePm + activeImplementations,
    },
    pipelineByStage,
    incidentsByCustomer,
    upcomingWorkload,
    recentCorrective: cmRows.slice(0, 4),
    upcomingPm: pmRows.filter((p) => p.status !== "Completed").slice(0, 4),
    upcomingEvents: eventRows.slice(0, 5),
    recentAlerts: alertLogs,
  });
}
