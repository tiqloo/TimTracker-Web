// Domain model — mirrors Domain/Models/TimeEntry.swift in TimTracker-Starter.
//
// Matches Domain/Enums/TimeEntrySource.swift's raw values exactly, and the
// DB's `time_entries_source_check` CHECK constraint (supabase/migrations/
// 0005_schema_hardening.sql) — CHECK (source = ANY (ARRAY['automatic',
// 'manual'])). The previous "auto" | "manual" | "pause" was wrong on both
// counts: "auto" doesn't match the real "automatic" DB value, and "pause"
// is never storable at all — an entry's Pause classification runs entirely
// through projectId (see PAUSE_PROJECT_ID / SwitchProjectUseCase.swift on
// the native side), never through `source`. See docs/audit-findings.md
// ("TimeEntry.source-TS-Typ passt nicht zur DB-CHECK-Constraint").
export type TimeEntrySource = "automatic" | "manual";

export interface TimeEntry {
  id: string;
  projectId: string;
  day: string; // ISO date (yyyy-MM-dd)
  startTime: string; // ISO datetime
  endTime: string | null; // null = still running
  source: TimeEntrySource;
  note: string | null;
  updatedAt: string;
}

// Mirrors Application/Interfaces/DailyBreakdown.swift, including the
// unassignedSeconds fix from Ticket 001 — same formula, same field names,
// so the web and native apps never disagree on what a day's numbers mean.
export interface DailyBreakdown {
  day: string;
  standardSeconds: number;
  projectSeconds: number;
  pauseSeconds: number;
  totalSeconds: number;
  unassignedSeconds: number;
}
