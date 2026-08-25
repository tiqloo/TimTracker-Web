// Application core (use cases) — mirrors StatisticsService.swift /
// HistoryLogViewModel.swift. Driving adapters (pages) call these
// functions, never lib/repositories/* directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_BREAKDOWN = (day: string): DailyBreakdown => ({
  day,
  standardSeconds: 0,
  projectSeconds: 0,
  pauseSeconds: 0,
  totalSeconds: 0,
  unassignedSeconds: 0,
});

export async function getTodayBreakdown(
  repos: Repositories,
): Promise<DailyBreakdown> {
  const today = isoToday();
  const [breakdown] = await repos.timeEntries.getBreakdown(today, today);
  return breakdown ?? EMPTY_BREAKDOWN(today);
}

export async function getTodayEntries(
  repos: Repositories,
): Promise<TimeEntry[]> {
  return repos.timeEntries.getForDay(isoToday());
}

export async function getHistory(
  repos: Repositories,
  fromDay: string,
  toDay: string,
): Promise<DailyBreakdown[]> {
  return repos.timeEntries.getBreakdown(fromDay, toDay);
}
