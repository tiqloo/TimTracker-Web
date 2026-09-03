// Application core (use cases) — mirrors StatisticsService.swift /
// HistoryLogViewModel.swift. Driving adapters (pages) call these
// functions, never lib/repositories/* directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";
import { calendarDayInTimeZone } from "../domain/calendar-day.ts";
import { ValidationError } from "../domain/application-error.ts";
import { addDaysIso, startOfWeekIso } from "@/lib/format";

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

export async function getEntriesForRange(
  repos: Repositories,
  fromDay: string,
  toDay: string,
  projectId?: string,
): Promise<TimeEntry[]> {
  return repos.timeEntries.getForRange(fromDay, toDay, projectId);
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

// Ticket 045 ("Wochenvergleich neben der Hero-Kennzahl auf 'Heute'") —
// "above"/"below" only once the gap clears SIMILAR_THRESHOLD_RATIO;
// anything smaller reads as normal day-to-day noise, not a real "you
// worked more/less" signal, and would just add a jittery-looking percent
// next to the hero number for what is essentially a typical day.
const SIMILAR_THRESHOLD_RATIO = 0.05;

// Edge case (ticket AK): "Montag / erster Tag mit Einträgen in der Woche
// -> kein sinnvoller 'bisheriger Wochenschnitt' vorhanden (0 oder 1
// Vergleichstag) -> Vergleichshinweis ausblenden". An average built from a
// single prior day isn't really "your week so far" — it's just yesterday
// again, so requiring at least two real comparison days before the hint
// is shown at all also covers the "1 Vergleichstag" half of that edge
// case, not just the literal 0-days Monday case.
const MIN_COMPARISON_DAYS = 2;

export type WeekComparisonTrend = "above" | "below" | "similar";

export interface WeekComparison {
  // Average totalSeconds across the comparison days only (days with
  // totalSeconds > 0) — a real day off/gap in the week must NOT be
  // averaged in as a 0 (ticket edge case: "Woche mit Lücken ... Durchschnitt
  // bezieht sich nur auf Tage mit tatsächlichen Einträgen, keine künstliche
  // 0-Einrechnung, die den Schnitt verfälscht").
  averageSecondsBeforeToday: number;
  comparisonDayCount: number;
  // Rounded, unsigned percent difference between today and the average —
  // the sign/direction is carried separately by `trend` so the i18n label
  // builder never has to re-derive it from a negative number.
  diffPercent: number;
  trend: WeekComparisonTrend;
}

// Reuses getHistory() for the actual data fetch (no new repository method,
// per the ticket's own AK) — the averaging/diff math below is the only new
// logic, and lives here rather than in components/DayDetail.tsx to keep
// that Hexagonal-Architecture boundary intact (component stays a pure
// renderer of already-computed values, same as every other DayDetail prop).
// `todayTotalSeconds` is passed in rather than fetched again here: the
// caller (app/(dashboard)/dashboard/page.tsx) already has today's
// DailyBreakdown from getTodayBreakdown(), and this is a snapshot
// comparison computed once per server render (like dailyGoalHours), not a
// second-by-second live value — TodayLiveRefresh already re-renders the
// whole page every 30s / on realtime changes / on focus, which is enough
// freshness for a secondary hint that just orients "more/less/about the
// same than usual", not a running clock.
export async function getWeekComparison(
  repos: Repositories,
  day: string,
  todayTotalSeconds: number,
): Promise<WeekComparison | null> {
  const weekStart = startOfWeekIso(day);
  // Monday itself (or, equivalently, `day` being the first calendar day of
  // its week): no earlier day in this week can exist yet, so there's
  // nothing to compare against at all — same "identisch zum 'Montag ohne
  // Vergleichstage'-Fall" case the ticket's own last edge case names for a
  // brand-new account's first-ever usage day.
  if (weekStart === day) return null;

  const priorDays = await getHistory(repos, weekStart, addDaysIso(day, -1));
  const comparisonDays = priorDays.filter((entry) => entry.totalSeconds > 0);
  if (comparisonDays.length < MIN_COMPARISON_DAYS) return null;

  const averageSecondsBeforeToday =
    comparisonDays.reduce((sum, entry) => sum + entry.totalSeconds, 0) / comparisonDays.length;
  // averageSecondsBeforeToday is always > 0 here (every comparisonDays
  // entry was filtered to totalSeconds > 0), so this division is safe —
  // no separate zero-guard needed.
  const diffRatio = (todayTotalSeconds - averageSecondsBeforeToday) / averageSecondsBeforeToday;
  const trend: WeekComparisonTrend =
    diffRatio > SIMILAR_THRESHOLD_RATIO
      ? "above"
      : diffRatio < -SIMILAR_THRESHOLD_RATIO
        ? "below"
        : "similar";

  return {
    averageSecondsBeforeToday,
    comparisonDayCount: comparisonDays.length,
    diffPercent: Math.round(Math.abs(diffRatio) * 100),
    trend,
  };
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
    throw new ValidationError("Project must not be empty.");
  }
  return repos.timeEntries.updateProject(entryId, trimmedProjectId);
}
