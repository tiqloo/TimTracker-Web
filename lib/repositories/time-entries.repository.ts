import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";

// Swap point for a future backend — see projects.repository.ts for the
// rationale. Pages/components depend only on this interface.
export interface TimeEntriesRepository {
  getForDay(day: string): Promise<TimeEntry[]>;
  // Flat, session-level entries across a range (unlike getBreakdown, which
  // pre-aggregates per day) — added for CSV/PDF export (lib/application/
  // export.ts), which needs one row per session, not just daily totals.
  getForRange(fromDay: string, toDay: string): Promise<TimeEntry[]>;
  getBreakdown(fromDay: string, toDay: string): Promise<DailyBreakdown[]>;
}
