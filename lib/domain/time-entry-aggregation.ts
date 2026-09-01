import type { DailyBreakdown, TimeEntry } from "./time-entry";

export const STANDARD_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
export const PAUSE_PROJECT_ID = "00000000-0000-0000-0000-000000000002";

export function timeEntryDurationSeconds(entry: TimeEntry, now: Date): number {
  const start = new Date(entry.startTime).getTime();
  const end = entry.endTime ? new Date(entry.endTime).getTime() : now.getTime();
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
