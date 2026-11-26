// Top-bar notification bell: what needs attention right now, per module the user can read.
// States come from the same shared helpers the list columns and alert emails use
// (slaInfo, pmScheduleInfo, deadlineInfo), so the bell always agrees with them.
import { and, eq, gte, lte, ne, notInArray } from "drizzle-orm";
import { correctiveMaintenances, customers, db, implementations, pocRecords, preventiveMaintenances, serviceNumbers } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { CORRECTIVE_DONE_STAGES, IMPL_DUE_SOON_DAYS, POC_DUE_SOON_DAYS } from "@/shared/constants";
import { deadlineInfo } from "@/shared/deadline";
import { pmScheduleInfo } from "@/shared/pm";
import { formatDuration, slaInfo } from "@/shared/sla";
import type { NotificationItem, NotificationsResponse } from "@/shared/types";

/** Same window the dashboard uses for "expiring" service contracts. */
const SERVICE_EXPIRY_DAYS = 30;
const DAY = 86_400_000;

type Ranked = NotificationItem & { sortAt: number };

async function correctiveItems(now: number): Promise<Ranked[]> {
  const rows = await db
    .select({
      id: correctiveMaintenances.id,
      code: correctiveMaintenances.ticketCode,
      title: correctiveMaintenances.title,
      status: correctiveMaintenances.status,
      dueDate: correctiveMaintenances.dueDate,
      createdAt: correctiveMaintenances.createdAt,
      resolvedAt: correctiveMaintenances.resolvedAt,
      customerName: customers.name,
    })
    .from(correctiveMaintenances)
    .leftJoin(customers, eq(correctiveMaintenances.customerId, customers.id))
    .where(notInArray(correctiveMaintenances.status, [...CORRECTIVE_DONE_STAGES]));
  return rows.flatMap((r) => {
    const sla = slaInfo(r, now);
    if (sla.state !== "breached" && sla.state !== "at-risk") return [];
    return [{
      id: `corrective-${r.id}`,
      module: "corrective" as const,
      level: sla.state === "breached" ? ("critical" as const) : ("warning" as const),
      code: r.code,
      title: r.title,
      status: sla.state === "breached" ? `SLA ${sla.label.toLowerCase()}` : `SLA at risk · ${sla.label}`,
      customerName: r.customerName,
      path: "/corrective",
      recordId: r.id,
      sortAt: r.dueDate ? r.dueDate.getTime() : now,
    }];
  });
}

async function preventiveItems(now: number): Promise<Ranked[]> {
  const rows = await db
    .select({
      id: preventiveMaintenances.id,
      code: preventiveMaintenances.planCode,
      title: preventiveMaintenances.title,
      status: preventiveMaintenances.status,
      scheduledDate: preventiveMaintenances.scheduledDate,
      lastCompletedAt: preventiveMaintenances.lastCompletedAt,
      customerName: customers.name,
    })
    .from(preventiveMaintenances)
    .leftJoin(customers, eq(preventiveMaintenances.customerId, customers.id))
    .where(ne(preventiveMaintenances.status, "Completed"));
  return rows.flatMap((r) => {
    const s = pmScheduleInfo(r, now);
    if (s.state !== "overdue" && s.state !== "due-today" && s.state !== "due-soon") return [];
    return [{
      id: `preventive-${r.id}`,
      module: "preventive" as const,
      level: s.state === "overdue" ? ("critical" as const) : ("warning" as const),
      code: r.code,
      title: r.title,
      status: `Visit ${s.label.charAt(0).toLowerCase()}${s.label.slice(1)}`,
      customerName: r.customerName,
      path: "/preventive",
      recordId: r.id,
      sortAt: r.scheduledDate.getTime(),
    }];
  });
}

async function implementationItems(now: number): Promise<Ranked[]> {
  const rows = await db
    .select({
      id: implementations.id,
      code: implementations.projectCode,
      title: implementations.title,
      targetGoLive: implementations.targetGoLive,
      customerName: customers.name,
    })
    .from(implementations)
    .leftJoin(customers, eq(implementations.customerId, customers.id))
    .where(ne(implementations.status, "Go-Live"));
  return rows.flatMap((r) => {
    const d = deadlineInfo({ due: r.targetGoLive, soonDays: IMPL_DUE_SOON_DAYS, noun: "Go-live" }, now);
    if (d.state !== "overdue" && d.state !== "due-soon") return [];
    return [{
      id: `implementation-${r.id}`,
      module: "implementation" as const,
      level: d.state === "overdue" ? ("critical" as const) : ("warning" as const),
      code: r.code,
      title: r.title,
      status: d.label,
      customerName: r.customerName,
      path: "/implementations",
      recordId: r.id,
      sortAt: r.targetGoLive ? r.targetGoLive.getTime() : now,
    }];
  });
}

async function pocItems(now: number): Promise<Ranked[]> {
  const rows = await db
    .select({
      id: pocRecords.id,
      code: pocRecords.pocCode,
      title: pocRecords.title,
      targetReviewDate: pocRecords.targetReviewDate,
      customerName: customers.name,
    })
    .from(pocRecords)
    .leftJoin(customers, eq(pocRecords.customerId, customers.id))
    .where(notInArray(pocRecords.outcome, ["Success", "Dropped"]));
  return rows.flatMap((r) => {
    const d = deadlineInfo({ due: r.targetReviewDate, soonDays: POC_DUE_SOON_DAYS, noun: "Review" }, now);
    if (d.state !== "overdue" && d.state !== "due-soon") return [];
    return [{
      id: `poc-${r.id}`,
      module: "poc" as const,
      level: d.state === "overdue" ? ("critical" as const) : ("warning" as const),
      code: r.code,
      title: r.title,
      status: d.label,
      customerName: r.customerName,
      path: "/poc",
      recordId: r.id,
      sortAt: r.targetReviewDate ? r.targetReviewDate.getTime() : now,
    }];
  });
}

async function serviceItems(now: number): Promise<Ranked[]> {
  const rows = await db
    .select({
      id: serviceNumbers.id,
      code: serviceNumbers.serviceNumber,
      title: serviceNumbers.title,
      endDate: serviceNumbers.endDate,
      customerName: customers.name,
    })
    .from(serviceNumbers)
    .leftJoin(customers, eq(serviceNumbers.customerId, customers.id))
    .where(
      and(
        notInArray(serviceNumbers.status, ["Expired", "Suspended"]),
        gte(serviceNumbers.endDate, new Date(now)),
        lte(serviceNumbers.endDate, new Date(now + SERVICE_EXPIRY_DAYS * DAY))
      )
    );
  return rows.map((r) => {
    const minutesLeft = (r.endDate.getTime() - now) / 60_000;
    return {
      id: `service-${r.id}`,
      module: "service" as const,
      level: "warning" as const,
      code: r.code,
      title: r.title,
      status: minutesLeft < 24 * 60 ? "Contract ends today" : `Contract ends in ${formatDuration(minutesLeft)}`,
      customerName: r.customerName,
      path: "/services",
      recordId: r.id,
      sortAt: r.endDate.getTime(),
    };
  });
}

/** Attention items the user may see, critical first, then soonest deadline first. */
export async function getNotifications(user: AuthenticatedUser): Promise<NotificationsResponse> {
  const now = Date.now();
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user.permissions, p);
  const groups = await Promise.all([
    can("maintenance:read") ? correctiveItems(now) : [],
    can("maintenance:read") ? preventiveItems(now) : [],
    can("delivery:read") ? implementationItems(now) : [],
    can("delivery:read") ? pocItems(now) : [],
    can("services:read") ? serviceItems(now) : [],
  ]);
  const ranked = groups.flat().sort((a, b) => (a.level === b.level ? a.sortAt - b.sortAt : a.level === "critical" ? -1 : 1));
  const items: NotificationItem[] = ranked.map(({ sortAt: _sortAt, ...item }) => item);
  return {
    items,
    counts: {
      critical: items.filter((i) => i.level === "critical").length,
      warning: items.filter((i) => i.level === "warning").length,
    },
  };
}
