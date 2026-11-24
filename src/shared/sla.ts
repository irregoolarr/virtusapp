// SLA calculations shared by the list UI (countdown) and the server (breach alerts).
import { SLA_HOURS_BY_SEVERITY, isCorrectiveDone } from "./constants";

export type SlaState = "none" | "on-track" | "at-risk" | "breached" | "met" | "missed";

export interface SlaInfo {
  state: SlaState;
  /** Short label for the grid, e.g. "3h 20m left", "Breached 2h ago", "Met". */
  label: string;
  /** Minutes until due (negative when overdue); null when there is no target. */
  minutesLeft: number | null;
}

/** Default SLA target for a new ticket from its priority. */
export function defaultSlaDue(severity: string, from = new Date()): Date {
  const hours = SLA_HOURS_BY_SEVERITY[severity] ?? 24;
  return new Date(from.getTime() + hours * 3_600_000);
}

export function formatDuration(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function slaInfo(
  ticket: { status: string; dueDate: string | Date | null; createdAt: string | Date; resolvedAt: string | Date | null },
  now = Date.now()
): SlaInfo {
  if (!ticket.dueDate) return { state: "none", label: "No SLA", minutesLeft: null };
  const due = new Date(ticket.dueDate).getTime();

  if (isCorrectiveDone(ticket.status)) {
    const doneAt = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : now;
    return doneAt <= due
      ? { state: "met", label: "Met", minutesLeft: null }
      : { state: "missed", label: `Missed by ${formatDuration((doneAt - due) / 60_000)}`, minutesLeft: null };
  }

  const minutesLeft = (due - now) / 60_000;
  if (minutesLeft < 0) return { state: "breached", label: `Breached ${formatDuration(minutesLeft)} ago`, minutesLeft };

  // "At risk" when less than a quarter of the SLA window remains.
  const windowMin = Math.max(1, (due - new Date(ticket.createdAt).getTime()) / 60_000);
  const state: SlaState = minutesLeft / windowMin < 0.25 ? "at-risk" : "on-track";
  return { state, label: `${formatDuration(minutesLeft)} left`, minutesLeft };
}
