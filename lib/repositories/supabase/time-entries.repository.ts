import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimeEntriesRepository } from "../time-entries.repository";
import type {
  DailyBreakdown,
  TimeEntry,
  TimeEntrySource,
} from "@/lib/types/time-entry";

// The two system pseudo-projects seeded by supabase/migrations/0001_init.sql
// / 0004_time_entries_project_fk.sql in TimTracker-Starter — every
// time_entries row belongs to one of these two, or a real customer
// project. Same constants Domain/Models/Project.swift uses
// (standardProjectID/pauseProjectID); keep in sync if they ever change.
const STANDARD_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const PAUSE_PROJECT_ID = "00000000-0000-0000-0000-000000000002";

interface TimeEntryRow {
  id: string;
  project_id: string;
  day: string;
  start_time: string;
  end_time: string | null;
  source: TimeEntrySource;
  note: string | null;
  updated_at: string;
}

function toDomain(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    day: row.day,
    startTime: row.start_time,
    endTime: row.end_time,
    source: row.source,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

function durationSeconds(entry: TimeEntry, now: Date): number {
  const start = new Date(entry.startTime).getTime();
  const end = entry.endTime ? new Date(entry.endTime).getTime() : now.getTime();
  return Math.max(0, Math.round((end - start) / 1000));
}

// Mirrors StatisticsService/DailyBreakdown.unassignedSeconds from the
// Swift app (Ticket 001 fix): unassignedSeconds = max(0, totalSeconds -
// projectSeconds), where totalSeconds excludes pause time. Do not
// reimplement this differently on the web — same formula, same meaning,
// or the two clients will disagree with each other.
function buildBreakdown(day: string, entries: TimeEntry[], now: Date): DailyBreakdown {
  let standardSeconds = 0;
  let projectSeconds = 0;
  let pauseSeconds = 0;

  for (const entry of entries) {
    const seconds = durationSeconds(entry, now);
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
}

export function createSupabaseTimeEntriesRepository(
  client: SupabaseClient,
): TimeEntriesRepository {
  return {
    async getForDay(day: string) {
      const { data, error } = await client
        .from("time_entries")
        .select("*")
        .eq("day", day)
        .is("deleted_at", null)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data as TimeEntryRow[]).map(toDomain);
    },

    async getBreakdown(fromDay: string, toDay: string) {
      const { data, error } = await client
        .from("time_entries")
        .select("*")
        .gte("day", fromDay)
        .lte("day", toDay)
        .is("deleted_at", null);
      if (error) throw error;

      const now = new Date();
      const entries = (data as TimeEntryRow[]).map(toDomain);
      const byDay = new Map<string, TimeEntry[]>();
      for (const entry of entries) {
        const bucket = byDay.get(entry.day) ?? [];
        bucket.push(entry);
        byDay.set(entry.day, bucket);
      }

      return Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, dayEntries]) => buildBreakdown(day, dayEntries, now));
    },
  };
}
