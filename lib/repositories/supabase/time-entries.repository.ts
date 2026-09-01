import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimeEntriesRepository } from "../time-entries.repository";
import type {
  TimeEntry,
  TimeEntrySource,
} from "@/lib/domain/time-entry";
import { collectAllPages } from "./pagination.ts";
import { buildDailyBreakdowns } from "../../domain/time-entry-aggregation.ts";
import { requireUpdatedRow } from "./mutation-result.ts";

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

const TIME_ENTRY_COLUMNS =
  "id, project_id, day, start_time, end_time, source, note, updated_at";

// `day` is stored as `timestamptz` in Postgres (0001_init.sql: "damit es
// exakt wie start_time/end_time/updated_at decodiert werden kann" — the
// client always writes literal midnight of the calendar day), so
// PostgREST returns it as a full ISO datetime ("2026-08-24T00:00:00+00:00"),
// not the plain "yyyy-MM-dd" the TimeEntry/DailyBreakdown domain types
// document. Normalize to the first 10 characters here, at the adapter
// boundary, so every consumer above this layer (getBreakdown/getForDay/
// getForRange callers, isoToday()-based query params, history/[day]'s
// route param) can rely on `day` actually being a plain ISO date — found
// while wiring up the "Historie" day-detail links/labels in Phase 1c,
// which were the first callers to actually render `.day` instead of just
// using it as an opaque grouping key.
function normalizeDay(day: string): string {
  return day.slice(0, 10);
}

function toDomain(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    day: normalizeDay(row.day),
    startTime: row.start_time,
    endTime: row.end_time,
    source: row.source,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

// `projectId` (Ticket 043): optional server-side filter for the "Historie"
// project dropdown — narrows the same range query to one project's rows
// instead of fetching everything and filtering in JS, so getBreakdown's
// buildBreakdown below never needs to know about the filter at all (it
// just aggregates whatever fetchRange handed it, same as before).
async function fetchRange(
  client: SupabaseClient,
  fromDay: string,
  toDay: string,
  projectId?: string,
): Promise<TimeEntry[]> {
  const rows = await collectAllPages<TimeEntryRow>(async (from, to) => {
    let query = client
      .from("time_entries")
      .select(TIME_ENTRY_COLUMNS)
      .gte("day", fromDay)
      .lte("day", toDay)
      .is("deleted_at", null);
    if (projectId) {
      query = query.eq("project_id", projectId);
    }
    const { data, error } = await query
      .order("start_time", { ascending: true })
      // Multiple entries may share a timestamp. A unique second key keeps
      // offset pages deterministic and prevents gaps/duplicates at a boundary.
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    return (data ?? []) as TimeEntryRow[];
  });
  return rows.map(toDomain);
}

export function createSupabaseTimeEntriesRepository(
  client: SupabaseClient,
): TimeEntriesRepository {
  return {
    async getForDay(day: string) {
      return fetchRange(client, day, day);
    },

    async getForRange(fromDay: string, toDay: string, projectId?: string) {
      return fetchRange(client, fromDay, toDay, projectId);
    },

    // Ticket 034: reassigns one entry's project_id. `updated_at` has no DB
    // trigger (0001_init.sql only defaults it on INSERT) — same finding
    // projects.repository.ts's rename()/setArchived() already documented
    // for the `projects` table: SyncEngine.swift uses `updatedAt` for
    // last-write-wins conflict resolution, so leaving it stale here would
    // both mis-order any future "most recently touched" listing and risk a
    // later native-app sync treating this web edit as older than a stale
    // local copy. Same explicit-set fix applied here.
    async updateProject(entryId: string, projectId: string) {
      const { data, error } = await client
        .from("time_entries")
        .update({ project_id: projectId, updated_at: new Date().toISOString() })
        .eq("id", entryId)
        .select(TIME_ENTRY_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return toDomain(requireUpdatedRow(data as TimeEntryRow | null, "Time entry"));
    },

    async getBreakdown(fromDay: string, toDay: string, projectId?: string) {
      const entries = await fetchRange(client, fromDay, toDay, projectId);
      return buildDailyBreakdowns(entries, new Date());
    },
  };
}
