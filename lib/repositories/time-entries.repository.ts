import type { DailyBreakdown, TimeEntry } from "@/lib/types/time-entry";

// Swap point for a future backend — see projects.repository.ts for the
// rationale. Pages/components depend only on this interface.
export interface TimeEntriesRepository {
  getForDay(day: string): Promise<TimeEntry[]>;
  getBreakdown(fromDay: string, toDay: string): Promise<DailyBreakdown[]>;
}
