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

export function timeEntryDurationSeconds(entry: TimeEntry, now: Date): number {
  const start = new Date(entry.startTime).getTime();
  const today = calendarDayInTimeZone(now);
  const end = entry.endTime
    ? new Date(entry.endTime).getTime()
    : entry.day < today
      ? startOfDayInstant(nextIsoDay(entry.day), PRODUCT_TIME_ZONE).getTime()
      : now.getTime();
  return Math.max(0, Math.round((end - start) / 1000));
}

export function buildDailyBreakdowns(
  entries: TimeEntry[],
  now: Date,
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
      let standardSeconds = 0;
      let projectSeconds = 0;
      let pauseSeconds = 0;

      for (const entry of dayEntries) {
        const seconds = timeEntryDurationSeconds(entry, now);
        if (entry.projectId === PAUSE_PROJECT_ID) {
          pauseSeconds += seconds;
        } else if (entry.projectId === STANDARD_PROJECT_ID) {
          standardSeconds += seconds;
        } else {
          projectSeconds += seconds;
        }
      }

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
