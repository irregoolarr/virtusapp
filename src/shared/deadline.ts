// Countdown to a target date (go-live, POC review) shared by UI and server.
import { formatDuration } from "./sla";

export type DeadlineState = "none" | "upcoming" | "due-soon" | "overdue" | "on-time" | "late" | "closed";

const DAY = 86_400_000;

/**
 * `due` is a target day; it counts as missed once that whole day has passed (24h grace).
 * `doneAt` set → finished (on time or late); `closedLabel` → finished without a date check.
 */
export function deadlineInfo(
  params: {
    due: string | Date | null;
    doneAt?: string | Date | null;
    closedLabel?: string | null;
    soonDays: number;
    noun: string; // "Go-live", "Review"
  },
  now = Date.now()
): { state: DeadlineState; label: string } {
  if (params.closedLabel) return { state: "closed", label: params.closedLabel };
  if (!params.due) return { state: "none", label: `No ${params.noun.toLowerCase()} date` };
  const due = new Date(params.due).getTime();
  if (params.doneAt) {
    const done = new Date(params.doneAt).getTime();
    return done <= due + DAY ? { state: "on-time", label: "Done on time" } : { state: "late", label: `Done ${formatDuration((done - due - DAY) / 60_000)} late` };
  }
  if (now > due + DAY) return { state: "overdue", label: `${params.noun} overdue ${formatDuration((now - due - DAY) / 60_000)}` };
  if (now >= due) return { state: "due-soon", label: `${params.noun} today` };
  const left = due - now;
  return {
    state: left <= params.soonDays * DAY ? "due-soon" : "upcoming",
    label: `${params.noun} in ${formatDuration(left / 60_000)}`,
  };
}
