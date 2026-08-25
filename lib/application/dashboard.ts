// Application core (use cases) — mirrors StatisticsService.swift /
// HistoryLogViewModel.swift. Driving adapters (pages) call these
// functions, never lib/repositories/* directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";

// Exported (not just an internal helper) so app/* pages that need "today"
// as a plain ISO string for their own purposes (e.g. building default
// history date-range links) can call it instead of reimplementing
// `new Date().toISOString().slice(0, 10)` themselves, and so they don't
// need a direct `new Date()` call in a component body (flagged by
// eslint's react-hooks/purity rule — see the currentTimeMs() comment in
// app/(dashboard)/page.tsx for the same workaround pattern).
export function isoToday(): string {
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

// Day-parameterized variants, added for the "Historie" day-detail page
// (history/[day]/page.tsx) which needs the exact same breakdown/entries
// shape as "Heute" but for an arbitrary past day, not hardcoded to today.
// getTodayBreakdown/getTodayEntries below now delegate to these rather
// than duplicating the logic — their own signatures/behavior are
// unchanged, so the already-tested "Heute" page doesn't need to change
// how it calls them.
export async function getBreakdownForDay(
  repos: Repositories,
  day: string,
): Promise<DailyBreakdown> {
  const [breakdown] = await repos.timeEntries.getBreakdown(day, day);
  return breakdown ?? EMPTY_BREAKDOWN(day);
}

export async function getEntriesForDay(
  repos: Repositories,
  day: string,
): Promise<TimeEntry[]> {
  return repos.timeEntries.getForDay(day);
}

export async function getTodayBreakdown(
  repos: Repositories,
): Promise<DailyBreakdown> {
  return getBreakdownForDay(repos, isoToday());
}

export async function getTodayEntries(
  repos: Repositories,
): Promise<TimeEntry[]> {
  return getEntriesForDay(repos, isoToday());
}

export async function getHistory(
  repos: Repositories,
  fromDay: string,
  toDay: string,
): Promise<DailyBreakdown[]> {
  return repos.timeEntries.getBreakdown(fromDay, toDay);
}
