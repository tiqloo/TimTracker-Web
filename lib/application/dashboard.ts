// Application core (use cases) — mirrors StatisticsService.swift /
// HistoryLogViewModel.swift. Driving adapters (pages) call these
// functions, never lib/repositories/* directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";
import { calendarDayInTimeZone } from "@/lib/domain/calendar-day";

// Exported (not just an internal helper) so app/* pages that need "today"
// as a plain ISO string for their own purposes (e.g. building default
// history date-range links) can call it instead of reimplementing
// `new Date().toISOString().slice(0, 10)` themselves, and so they don't
// need a direct `new Date()` call in a component body (flagged by
// eslint's react-hooks/purity rule — see the currentTimeMs() comment in
// app/(dashboard)/page.tsx for the same workaround pattern).
export function isoToday(now: Date = new Date()): string {
  return calendarDayInTimeZone(now);
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

// `projectId` (Ticket 043 — Historie calendar + project filter): optional,
// narrows the breakdown to a single project's entries. Threaded straight
// through to the port — see TimeEntriesRepository.getBreakdown's own
// comment for why the aggregation math (buildBreakdown in the Supabase
// adapter) doesn't need to change at all for this.
export async function getHistory(
  repos: Repositories,
  fromDay: string,
  toDay: string,
  projectId?: string,
): Promise<DailyBreakdown[]> {
  return repos.timeEntries.getBreakdown(fromDay, toDay, projectId);
}

// Ticket 034 ("Nicht zugeordnete Zeit" -> Projekt zuordnen), used by
// components/AssignTimeAction.tsx (a Client Component, via
// lib/application/client.ts's getRepositories()) — mirrors this file's
// existing thin-wrapper shape (projects.ts's renameProject/archiveProject)
// rather than adding business logic that doesn't exist yet: today the
// only rule is "you can't assign to an empty/blank project id", enforced
// here so a caller with a stray blank <select> value fails fast with a
// clear message instead of sending a request that would either violate
// the projects_id FK or (worse) silently no-op.
export async function assignTimeEntryToProject(
  repos: Repositories,
  entryId: string,
  projectId: string,
): Promise<TimeEntry> {
  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId) {
    throw new Error("Projekt darf nicht leer sein");
  }
  return repos.timeEntries.updateProject(entryId, trimmedProjectId);
}
