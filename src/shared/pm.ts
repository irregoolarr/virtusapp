// Preventive-maintenance schedule helpers shared by the UI and the server.
import { PM_DUE_SOON_DAYS, PM_FREQUENCY_MONTHS } from "./constants";
import { formatDuration } from "./sla";

export type PmScheduleState = "upcoming" | "due-soon" | "due-today" | "overdue" | "on-time" | "late";

/** A visit is overdue once its scheduled day has fully passed (24h grace). */
const GRACE_MS = 24 * 3_600_000;

/** Same day-of-month N months later (clamped to the month's last day). */
export function nextVisitDate(from: string | Date, frequency: string): Date {
  const d = new Date(from);
  const months = PM_FREQUENCY_MONTHS[frequency] ?? 3;
  const day = d.getDate();
  const next = new Date(d);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export function pmScheduleInfo(
  plan: { status: string; scheduledDate: string | Date; lastCompletedAt: string | Date | null },
  now = Date.now()
): { state: PmScheduleState; label: string } {
  const due = new Date(plan.scheduledDate).getTime();
  if (plan.status === "Completed") {
    const doneAt = plan.lastCompletedAt ? new Date(plan.lastCompletedAt).getTime() : now;
    return doneAt <= due + GRACE_MS
      ? { state: "on-time", label: "Done on time" }
      : { state: "late", label: `Done ${formatDuration((doneAt - due - GRACE_MS) / 60_000)} late` };
  }
  if (now > due + GRACE_MS) return { state: "overdue", label: `Overdue ${formatDuration((now - due - GRACE_MS) / 60_000)}` };
  if (now >= due) return { state: "due-today", label: "Due today" };
  const minutesLeft = (due - now) / 60_000;
  return minutesLeft <= PM_DUE_SOON_DAYS * 24 * 60
    ? { state: "due-soon", label: `Due in ${formatDuration(minutesLeft)}` }
    : { state: "upcoming", label: `Due in ${formatDuration(minutesLeft)}` };
}
