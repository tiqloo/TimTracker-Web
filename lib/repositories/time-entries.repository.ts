import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";

// Ticket 195 ("Zeiteinträge manuell bearbeiten/löschen/nachtragen"):
// input shapes for updateEntry/createEntry below. `startTime`/`endTime`
// are full ISO instants (not "HH:mm") — the caller (lib/application/
// dashboard.ts's updateTimeEntry/createTimeEntry) already converts the
// form's raw HH:mm inputs via lib/format.ts#fromDayAndTimeInput before
// reaching this layer, same "repository stays dumb, application layer
// validates/transforms" split as every other mutation in this file.
export interface UpdateTimeEntryInput {
  projectId: string;
  startTime: string;
  endTime: string;
  note: string | null;
}

export interface CreateTimeEntryInput {
  day: string;
  projectId: string;
  startTime: string;
  endTime: string;
  note: string | null;
}

// Swap point for a future backend — see projects.repository.ts for the
// rationale. Pages/components depend only on this interface.
export interface TimeEntriesRepository {
  getForDay(day: string): Promise<TimeEntry[]>;
  // Flat, session-level entries across a range (unlike getBreakdown, which
  // pre-aggregates per day) — added for CSV/PDF export (lib/application/
  // export.ts), which needs one row per session, not just daily totals.
  // `projectId` (Ticket 043 — Historie project filter): optional, narrows
  // both methods to a single project's entries when set. Added at the end
  // as an optional param so every pre-existing call site (getFullDataExport
  // in lib/application/data-export.ts, history/[day]'s day-detail page)
  // keeps compiling unchanged — only the "Historie" list/chart/export
  // callers pass it.
  getForRange(fromDay: string, toDay: string, projectId?: string): Promise<TimeEntry[]>;
  getBreakdown(fromDay: string, toDay: string, projectId?: string): Promise<DailyBreakdown[]>;
  // Ticket 034 ("Nicht zugeordnete Zeit" -> Projekt zuordnen): reassigns a
  // single time entry to a different project by updating its `project_id`
  // — the only write this repository needed before this ticket was
  // getForDay/getForRange/getBreakdown, all read-only. Per-entry (not a
  // whole-day bulk move) on purpose, mirroring the ticket's own edge case:
  // "mehrere nicht zusammenhängende Segmente am selben Tag -> jedes Segment
  // einzeln zuordenbar, keine erzwungene Alles-oder-nichts-Zuordnung".
  // Returns the updated TimeEntry so callers (DayDetail.tsx) can patch
  // their local state without a full reload/refetch.
  updateProject(entryId: string, projectId: string): Promise<TimeEntry>;

  // Ticket 195: full edit (start/end/project/note) of an existing entry —
  // unlike updateProject above, this powers a dedicated "Bearbeiten"
  // action available on EVERY entry (not just an unassigned automatic
  // one). Kept as a separate method rather than generalizing
  // updateProject itself, so Ticket 034's existing AssignTimeAction call
  // site/tests stay untouched — same "small, local, per-feature methods
  // over one do-everything signature" convention this file already
  // follows (getForDay/getForRange/getBreakdown are three methods, not
  // one with optional flags).
  updateEntry(entryId: string, input: UpdateTimeEntryInput): Promise<TimeEntry>;

  // Ticket 195: soft-deletes one entry (sets `deleted_at`) — the same
  // tombstone convention the sync engine already uses for offline
  // deletes, not a hard DELETE (the DB's own `time_entries_delete_own_
  // tombstones` RLS policy only permits a hard DELETE on an ALREADY-
  // tombstoned row, by design — see that policy's own migration comment).
  deleteEntry(entryId: string): Promise<void>;

  // Ticket 195: creates a brand-new, manually backfilled entry (source
  // "manual") for a day that may have no automatic tracking at all —
  // e.g. a day worked entirely offline/on paper. Returns the created
  // entry so the caller (AddTimeEntryAction.tsx) can append it to local
  // state without a full reload, same pattern as every other mutation
  // here.
  createEntry(input: CreateTimeEntryInput): Promise<TimeEntry>;
}
