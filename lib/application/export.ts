// Application core (use case) — mirrors Application/Services/ExportService.swift.
// Builds session-level ExportRow data for a date range, joined with each
// entry's project name/customer, for the "Historie" CSV export. The
// getHistory use case (dashboard.ts) already covers the per-day summary
// rows the export also needs — this file only adds the per-session rows,
// it doesn't duplicate the breakdown math.
//
// PDF export (PDFExporter.swift/HistoryExportPageView.swift in the native
// app) is deliberately NOT implemented here yet — see the comment on
// formatHistoryCsv's caller (app/(dashboard)/history/page.tsx) for why.
import type { Repositories } from "@/lib/repositories/repositories";
import type { ExportRow } from "@/lib/domain/export-row";

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

export async function getExportRows(
  repos: Repositories,
  fromDay: string,
  toDay: string,
): Promise<ExportRow[]> {
  const [entries, projects] = await Promise.all([
    repos.timeEntries.getForRange(fromDay, toDay),
    repos.projects.getAll(),
  ]);

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const now = new Date();

  return entries
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((entry) => {
      const project = projectById.get(entry.projectId);
      const startMs = new Date(entry.startTime).getTime();
      const endMs = entry.endTime ? new Date(entry.endTime).getTime() : now.getTime();
      return {
        id: entry.id,
        day: entry.day,
        projectName:
          project?.name ?? SYSTEM_PROJECT_NAMES[entry.projectId] ?? "Unbekanntes Projekt",
        customerName: project?.customer ? project.customer : "–",
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationSeconds: Math.max(0, Math.round((endMs - startMs) / 1000)),
        isRunning: entry.endTime === null,
      } satisfies ExportRow;
    });
}
