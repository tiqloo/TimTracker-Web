// Application core (use case) — mirrors Application/Services/ExportService.swift.
// Builds session-level ExportRow data for a date range, joined with each
// entry's project name/customer, for the "Historie" CSV/PDF export. The
// Both export formats use getHistoryExportData so entries are fetched once
// and per-session rows plus daily summaries come from the same snapshot.
import type { Repositories } from "@/lib/repositories/repositories";
import type { ExportRow } from "@/lib/domain/export-row";
import type { Project } from "@/lib/domain/project";
import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";
import {
  buildDailyBreakdowns,
  timeEntryDurationSeconds,
} from "../domain/time-entry-aggregation.ts";

// The two system pseudo-projects (see Domain/Models/Project.swift's
// standardProjectID/pauseProjectID and the matching constants in
// lib/repositories/supabase/time-entries.repository.ts). Found while
// testing this against real seeded data: `projects.getAll()` NEVER
// returns these two — 0004_time_entries_project_fk.sql's own comment
// confirms the RLS policy (`auth.uid() = user_id`) makes their
// `user_id = NULL` rows invisible to every client on purpose, real
// projects.getAll() call included. Without this fallback every
// "Arbeitszeit"/"Pause" session in the export would misleadingly show as
// "Unbekanntes Projekt" — mirrors ExportService.swift's
// `projects.first { $0.id == entry.projectId } ?? .standard` fallback,
// done per-ID here instead of Swift's single blanket `.standard` fallback
// so a real Pause entry doesn't get mislabeled "Arbeitszeit".
const SYSTEM_PROJECT_NAMES: Record<string, string> = {
  "00000000-0000-0000-0000-000000000001": "Arbeitszeit",
  "00000000-0000-0000-0000-000000000002": "Pause",
};

// `projectId` (Ticket 043): optional, narrows the export to a single
// project's sessions — the CSV/PDF export routes pass through whatever
// filter is active on the "Historie" page so an export always matches
// what's currently on screen, instead of always exporting everything.
export interface HistoryExportData {
  rows: ExportRow[];
  summaries: DailyBreakdown[];
}

export function buildExportRows(
  entries: TimeEntry[],
  projects: Project[],
  now: Date,
  timeZone?: string,
): ExportRow[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return entries
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
    .map((entry) => {
      const project = projectById.get(entry.projectId);
      return {
        id: entry.id,
        day: entry.day,
        projectName:
          project?.name ?? SYSTEM_PROJECT_NAMES[entry.projectId] ?? "Unbekanntes Projekt",
        customerName: project?.customer ? project.customer : "–",
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationSeconds: timeEntryDurationSeconds(entry, now, timeZone),
        isRunning: entry.endTime === null,
      } satisfies ExportRow;
    });
}

// Loads every source collection exactly once. CSV and PDF pass their already
// loaded project list so validation, row labels and summaries share one
// consistent snapshot even when an entry is running during the export.
export async function getHistoryExportData(
  repos: Repositories,
  fromDay: string,
  toDay: string,
  projects: Project[],
  projectId?: string,
  timeZone?: string,
): Promise<HistoryExportData> {
  const entries = await repos.timeEntries.getForRange(fromDay, toDay, projectId);
  const now = new Date();
  return {
    rows: buildExportRows(entries, projects, now, timeZone),
    summaries: buildDailyBreakdowns(entries, now, timeZone),
  };
}
