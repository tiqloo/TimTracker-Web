// Pure pagination logic for the "Historie" PDF export — mirrors
// Integrations/PDF/HistoryExportPaginator.swift verbatim (same
// overflow/month-change rules), split into its own file for the same
// reason the Swift original is: unit-testable without pulling in the
// actual PDF renderer (there, PDFKit/AppKit; here, @react-pdf/renderer's
// Document/Page components, kept in history-export-document.tsx). No
// Repositories dependency — rows/summaries are already fetched by the
// caller — so like lib/format.ts's formatHistoryCsv/buildChartBars this
// lives outside lib/application/*.
import type { ExportRow } from "@/lib/domain/export-row";
import type { DailyBreakdown } from "@/lib/domain/time-entry";

export interface HistoryExportDayChunk {
  day: DailyBreakdown;
  rows: ExportRow[];
}

// Same default as PDFExporter.swift's `maxRowsPerPage = 26`.
const DEFAULT_MAX_ROWS_PER_PAGE = 26;

function monthOf(isoDay: string): string {
  return isoDay.slice(5, 7);
}

// Groups rows/summaries into day chunks, then splits those chunks into
// pages: a new page starts whenever adding the next day chunk would
// overflow `maxRowsPerPage`, OR the calendar month changes from the
// previous chunk on the current page (page break per month, per the
// ticket's AK) — same two conditions, same precedence (checked together,
// page only breaks between chunks, never mid-chunk) as the Swift
// original. Returns [] when there are no days at all (empty period) —
// the caller (history-export-document.tsx) is responsible for still
// rendering a single header-only page in that case, matching
// PDFExporter.swift's `if pages.isEmpty { append(...) }` fallback.
export function paginateHistoryExport(
  rows: ExportRow[],
  dailySummaries: DailyBreakdown[],
  maxRowsPerPage: number = DEFAULT_MAX_ROWS_PER_PAGE,
): HistoryExportDayChunk[][] {
  if (dailySummaries.length === 0) return [];

  const rowsByDay = new Map<string, ExportRow[]>();
  for (const row of rows) {
    const bucket = rowsByDay.get(row.day) ?? [];
    bucket.push(row);
    rowsByDay.set(row.day, bucket);
  }

  const chunks: HistoryExportDayChunk[] = dailySummaries
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((day) => ({
      day,
      rows: (rowsByDay.get(day.day) ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));

  const pages: HistoryExportDayChunk[][] = [];
  let currentPage: HistoryExportDayChunk[] = [];
  let currentRowCount = 0;
  let currentMonth: string | null = null;

  for (const chunk of chunks) {
    const month = monthOf(chunk.day.day);
    const chunkRowCount = chunk.rows.length + 1; // + its own summary row
    const wouldOverflow = currentRowCount + chunkRowCount > maxRowsPerPage;
    const monthChanged = currentMonth !== null && currentMonth !== month;

    if (currentPage.length > 0 && (wouldOverflow || monthChanged)) {
      pages.push(currentPage);
      currentPage = [];
      currentRowCount = 0;
    }

    currentPage.push(chunk);
    currentRowCount += chunkRowCount;
    currentMonth = month;
  }

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}
