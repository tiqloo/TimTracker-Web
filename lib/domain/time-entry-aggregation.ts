import type { DailyBreakdown, TimeEntry } from "./time-entry";
import {
  calendarDayInTimeZone,
  PRODUCT_TIME_ZONE,
} from "./calendar-day.ts";

export const STANDARD_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
export const PAUSE_PROJECT_ID = "00000000-0000-0000-0000-000000000002";

function nextIsoDay(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  const representedAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return representedAsUtc - instant.getTime();
}

function startOfDayInstant(isoDay: string, timeZone: string): Date {
  const utcMidnight = new Date(`${isoDay}T00:00:00Z`);
  let candidate = new Date(utcMidnight.getTime() - timeZoneOffsetMs(utcMidnight, timeZone));
  // A second pass handles an offset change between the UTC guess and local midnight.
  candidate = new Date(utcMidnight.getTime() - timeZoneOffsetMs(candidate, timeZone));
  return candidate;
}

// Ticket 118 — `timeZone` defaults to the historical hardcoded
// PRODUCT_TIME_ZONE so every pre-existing caller (and this file's own
// tests) keeps compiling/behaving unchanged; real callers with a resolved
// workspace timezone (lib/application/dashboard.ts, export.ts,
// history-insights.ts) pass it explicitly instead. This only affects the
// end-of-day CLAMP for a still-open entry from a past day — which day an
// entry itself belongs to (`entry.day`) is decided once, at creation time,
// by whichever app wrote it (see time_entries.repository.ts's own
// comment); this function never re-derives or changes that.
function timeEntryInterval(entry: TimeEntry, now: Date, timeZone: string = PRODUCT_TIME_ZONE): { startMs: number; endMs: number } {
  const startMs = new Date(entry.startTime).getTime();
  const today = calendarDayInTimeZone(now, timeZone);
  const endMs = entry.endTime
    ? new Date(entry.endTime).getTime()
    : entry.day < today
      ? startOfDayInstant(nextIsoDay(entry.day), timeZone).getTime()
      : now.getTime();
  return { startMs, endMs: Math.max(startMs, endMs) };
}

export function timeEntryDurationSeconds(entry: TimeEntry, now: Date, timeZone: string = PRODUCT_TIME_ZONE): number {
  const { startMs, endMs } = timeEntryInterval(entry, now, timeZone);
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

/**
 * Ticket 086: sums the WALL-CLOCK UNION of a set of entries' intervals
 * instead of their individual durations — two entries that overlap in time
 * (e.g. a duplicate/orphaned entry from Ticket 084) must count that
 * overlap once, not twice. Sort-and-merge over each entry's own
 * `timeEntryInterval` (already reused by `timeEntryDurationSeconds`, so the
 * running-entry/negative-duration clamping stays identical either way).
 */
export function unionSeconds(entries: TimeEntry[], now: Date, timeZone: string = PRODUCT_TIME_ZONE): number {
  const intervals = entries
    .map((entry) => timeEntryInterval(entry, now, timeZone))
    .filter(({ startMs, endMs }) => endMs > startMs)
    .sort((a, b) => a.startMs - b.startMs);

  let totalMs = 0;
  let mergedStart: number | null = null;
  let mergedEnd = 0;
  for (const { startMs, endMs } of intervals) {
    if (mergedStart === null) {
      mergedStart = startMs;
      mergedEnd = endMs;
      continue;
    }
    if (startMs <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, endMs);
    } else {
      totalMs += mergedEnd - mergedStart;
      mergedStart = startMs;
      mergedEnd = endMs;
    }
  }
  if (mergedStart !== null) {
    totalMs += mergedEnd - mergedStart;
  }
  return Math.round(totalMs / 1000);
}

export function buildDailyBreakdowns(
  entries: TimeEntry[],
  now: Date,
  timeZone: string = PRODUCT_TIME_ZONE,
): DailyBreakdown[] {
  const byDay = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const bucket = byDay.get(entry.day) ?? [];
    bucket.push(entry);
    byDay.set(entry.day, bucket);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayEntries]) => {
      // Ticket 086 AK, option (a): union WITHIN each of the three existing
      // categories separately — an overlap between e.g. a project entry and
      // a pause entry is intentionally NOT resolved across categories (no
      // new cross-category priority rule), only duplicate/overlapping
      // entries within the SAME category are deduplicated.
      const standardEntries = dayEntries.filter((entry) => entry.projectId === STANDARD_PROJECT_ID);
      const projectEntries = dayEntries.filter(
        (entry) => entry.projectId !== STANDARD_PROJECT_ID && entry.projectId !== PAUSE_PROJECT_ID,
      );
      const pauseEntries = dayEntries.filter((entry) => entry.projectId === PAUSE_PROJECT_ID);

      const standardSeconds = unionSeconds(standardEntries, now, timeZone);
      const projectSeconds = unionSeconds(projectEntries, now, timeZone);
      const pauseSeconds = unionSeconds(pauseEntries, now, timeZone);

      const totalSeconds = standardSeconds + projectSeconds;
      return {
        day,
        standardSeconds,
        projectSeconds,
        pauseSeconds,
        totalSeconds,
        unassignedSeconds: Math.max(0, totalSeconds - projectSeconds),
      };
    });
}
