import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";

// Swap point for a future backend — see projects.repository.ts for the
// rationale. Pages/components depend only on this interface.
export interface TimeEntriesRepository {
  getForDay(day: string): Promise<TimeEntry[]>;
  // Flat, session-level entries across a range (unlike getBreakdown, which
  // pre-aggregates per day) — added for CSV/PDF export (lib/application/
  // export.ts), which needs one row per session, not just daily totals.
  // `projectId` (Ticket 043 — Historie project filter): optional, narrows
  // both methods to a single project's entries when set. Added at the end
  // as an optional param so every pre-existing call site (getFullDataExport
  // in lib/application/data-export.ts, history/[day]'s day-detail page)
  // keeps compiling unchanged — only the "Historie" list/chart/export
  // callers pass it.
  getForRange(fromDay: string, toDay: string, projectId?: string): Promise<TimeEntry[]>;
  getBreakdown(fromDay: string, toDay: string, projectId?: string): Promise<DailyBreakdown[]>;
}
