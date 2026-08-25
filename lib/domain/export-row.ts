// Domain model — mirrors Application/Interfaces/ExportRow.swift in
// TimTracker-Starter (kept in lib/domain/* like DailyBreakdown, even
// though its Swift counterpart lives under Application/Interfaces rather
// than Domain/Models — same precedent already set by DailyBreakdown in
// time-entry.ts). One row per time-entry session in a CSV/PDF export,
// already joined with its project's name/customer so the exporter itself
// doesn't need repository access.
export interface ExportRow {
  id: string;
  day: string; // ISO date (yyyy-MM-dd)
  projectName: string;
  // "–" when the project has no customer set, mirroring
  // ExportService.swift's `project.customer.isEmpty ? "–" : project.customer`.
  customerName: string;
  startTime: string; // ISO datetime
  endTime: string | null; // null when isRunning
  durationSeconds: number;
  isRunning: boolean;
}
