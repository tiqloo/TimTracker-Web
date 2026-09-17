import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateTimeEntryInput,
  TimeEntriesRepository,
  UpdateTimeEntryInput,
} from "../time-entries.repository";
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
  workspaceId: string,
  fromDay: string,
  toDay: string,
  projectId?: string,
): Promise<TimeEntry[]> {
  const rows = await collectAllPages<TimeEntryRow>(async (from, to) => {
    let query = client
      .from("time_entries")
      .select(TIME_ENTRY_COLUMNS)
      .eq("workspace_id", workspaceId)
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

// Ticket 103 — same lazy-thunk reasoning as
// projects.repository.ts#createSupabaseProjectsRepository's own comment.
// Ticket 118 — `getActiveWorkspaceTimeZone` is a second, independent
// thunk (not folded into a single "workspace context" object) for the
// same reason getActiveWorkspaceId itself is a thunk and not a resolved
// value: composition roots wire this factory before request-scoped
// resolution has necessarily happened, and Client-Component callers need
// a value resolved FRESH on every call, never captured once.
export function createSupabaseTimeEntriesRepository(
  client: SupabaseClient,
  getActiveWorkspaceId: () => Promise<string>,
  getActiveWorkspaceTimeZone: () => Promise<string>,
): TimeEntriesRepository {
  return {
    async getForDay(day: string) {
      const workspaceId = await getActiveWorkspaceId();
      return fetchRange(client, workspaceId, day, day);
    },

    async getForRange(fromDay: string, toDay: string, projectId?: string) {
      const workspaceId = await getActiveWorkspaceId();
      return fetchRange(client, workspaceId, fromDay, toDay, projectId);
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

    // Ticket 195: full edit — same explicit `updated_at` reasoning as
    // updateProject above (no DB trigger re-stamps it on UPDATE).
    // `endTime`/`startTime` arrive as already-validated ISO instants (see
    // lib/application/dashboard.ts#updateTimeEntry) — the DB's own
    // `time_entries_end_after_start_check` CHECK constraint
    // (TimTracker-Starter migration `20260926090000_time_entry_end_after_start.sql`)
    // is the authoritative, defense-in-depth backstop either way.
    async updateEntry(entryId: string, input: UpdateTimeEntryInput) {
      const { data, error } = await client
        .from("time_entries")
        .update({
          project_id: input.projectId,
          start_time: input.startTime,
          end_time: input.endTime,
          note: input.note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entryId)
        .select(TIME_ENTRY_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return toDomain(requireUpdatedRow(data as TimeEntryRow | null, "Time entry"));
    },

    // Ticket 195: soft-delete via `deleted_at`, not a hard DELETE — see
    // this method's own doc on the TimeEntriesRepository interface for
    // why. `.is("deleted_at", null)` in the WHERE clause makes this
    // idempotent (a second delete attempt on an already-tombstoned row
    // matches zero rows and surfaces as the same "not found" error as
    // deleting a nonexistent id, rather than silently re-stamping
    // `deleted_at`/`updated_at` a second time).
    async deleteEntry(entryId: string) {
      const { data, error } = await client
        .from("time_entries")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", entryId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      requireUpdatedRow(data, "Time entry");
    },

    // Ticket 195: manual backfill entry. Same id/user_id/workspace_id
    // pattern projects.repository.ts#create already established (`id`
    // has no DB default, `user_id`/`workspace_id` are both required by
    // the INSERT RLS policy) — see that method's own comment for the
    // full history of why each of the three is set explicitly here.
    // `source: "manual"` (not "automatic") is the one fixed value this
    // method always writes — matches the native app's own manual-
    // project-tracking sessions, and is how a backfilled entry stays
    // distinguishable from real automatic tracking in any future
    // reporting that cares about the distinction.
    async createEntry(input: CreateTimeEntryInput) {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Not authenticated");
      const workspaceId = await getActiveWorkspaceId();
      const { data, error } = await client
        .from("time_entries")
        .insert({
          id: crypto.randomUUID(),
          user_id: userData.user.id,
          workspace_id: workspaceId,
          project_id: input.projectId,
          day: input.day,
          start_time: input.startTime,
          end_time: input.endTime,
          source: "manual",
          note: input.note,
          updated_at: new Date().toISOString(),
        })
        .select(TIME_ENTRY_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return toDomain(requireUpdatedRow(data as TimeEntryRow | null, "Time entry"));
    },

    async getBreakdown(fromDay: string, toDay: string, projectId?: string) {
      const [workspaceId, timeZone] = await Promise.all([getActiveWorkspaceId(), getActiveWorkspaceTimeZone()]);
      const entries = await fetchRange(client, workspaceId, fromDay, toDay, projectId);
      return buildDailyBreakdowns(entries, new Date(), timeZone);
    },
  };
}
