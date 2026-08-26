// Pure formatting helpers — no side effects, no data access, so this
// lives outside lib/application/* (which is reserved for use cases that
// take a Repositories argument) and outside lib/domain/* (which holds
// models + business rules, not display formatting). Safe to import from
// both Server and Client Components.
import type { ExportRow } from "@/lib/domain/export-row";
import type { DailyBreakdown } from "@/lib/domain/time-entry";

// Mirrors TimeFormatter.shortDurationString(from:) in
// Shared/Helpers/TimeFormatter.swift (TimTracker-Starter) — same
// "Xh Ym" / "Ym" shape, so the web and native apps show duration
// identically for the same underlying seconds value.
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// "14:32" in the viewer's local time zone — used for time-entry start/end
// times in the flat "Heute" list.
export function formatTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "24. August 2026" — used as the heading on a "Historie" day-detail page
// (history/[day]/page.tsx). Parsed as local midnight (not UTC) so the
// displayed date always matches the `day` string itself regardless of the
// viewer's time zone offset. `locale` defaults to "de-DE" (this call
// site's existing behavior, unchanged for every current caller) — added
// as a parameter, not hardcoded, so settings/billing/page.tsx (Ticket
// 018, Phase 1e) can pass the resolved language preference's locale
// instead without a second near-duplicate function.
export function formatDayLabel(isoDay: string, locale: string = "de-DE"): string {
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Same shape as formatDayLabel, but for a full ISO datetime (e.g.
// `subscriptions.current_period_end`, a timestamptz) rather than a plain
// yyyy-MM-dd day string — used by settings/billing/page.tsx to show the
// trial/period end date.
export function formatFullDate(isoDateTime: string, locale: string = "de-DE"): string {
  return new Date(isoDateTime).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Pure date-string arithmetic for "Historie"'s period selection (used by
// both history/page.tsx for its preset links and history/export/route.ts
// for resolving the same range server-side) — deliberately string-in/
// string-out on ISO yyyy-MM-dd, so nothing here calls `new Date()` with no
// argument or `Date.now()` and none of it trips eslint's react-hooks/purity
// rule when called from a Server Component body.
export function addDaysIso(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfWeekIso(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  const weekday = date.getUTCDay(); // 0 = Sunday
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  return addDaysIso(isoDay, diffToMonday);
}

export function startOfMonthIso(isoDay: string): string {
  return `${isoDay.slice(0, 7)}-01`;
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  from: string;
  to: string;
}

// Resolves the "Historie" query-param range against a default of the last
// 30 days ending `today` (Ticket 018: "default to a sensible recent
// range"). Any invalid/missing param falls back to the default entirely
// (no partial-valid handling) — the simplest behavior that can't produce a
// confusing mixed state. `today` is passed in rather than computed here so
// callers keep sole ownership of the one non-deterministic `isoToday()`
// call (see lib/application/dashboard.ts).
export function resolveHistoryRange(
  today: string,
  params: { from?: string; to?: string },
): DateRange {
  const requestedFrom = params.from && ISO_DAY_RE.test(params.from) ? params.from : null;
  const requestedTo = params.to && ISO_DAY_RE.test(params.to) ? params.to : null;
  let from = requestedFrom ?? addDaysIso(today, -29);
  let to = requestedTo ?? today;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

// Flat CSV export for "Historie": one row per session plus one daily
// summary row per day, semicolon-delimited (German Excel splits columns
// correctly on ";" because "," is its decimal separator) — same shape as
// CSVExporter.swift's makeCSV(rows:dailySummaries:), including its exact
// column set and the "läuft noch" marker for a still-running entry, so a
// user comparing an export from the web app and the native app sees the
// same thing. Pure (rows/summaries already fetched by the caller), so it
// lives here rather than in lib/application/*.
const CSV_DELIMITER = ";";

function escapeCsvField(field: string): string {
  if (!/[;"\n]/.test(field)) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

function csvHours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

function csvLine(fields: string[]): string {
  return fields.map(escapeCsvField).join(CSV_DELIMITER);
}

export function formatHistoryCsv(rows: ExportRow[], summaries: DailyBreakdown[]): string {
  const rowsByDay = new Map<string, ExportRow[]>();
  for (const row of rows) {
    const bucket = rowsByDay.get(row.day) ?? [];
    bucket.push(row);
    rowsByDay.set(row.day, bucket);
  }

  const lines: string[] = [
    csvLine([
      "Datum",
      "Projekt",
      "Kunde",
      "Start",
      "Ende",
      "Dauer (h)",
      "Automatikzeit (h)",
      "Projektzeit (h)",
      "Nicht zugeordnet (h)",
    ]),
  ];

  for (const summary of summaries) {
    const dayRows = (rowsByDay.get(summary.day) ?? []).slice().sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    for (const row of dayRows) {
      const endText = row.isRunning
        ? "läuft noch"
        : row.endTime
          ? formatTime(row.endTime)
          : "";
      lines.push(
        csvLine([
          summary.day,
          row.projectName,
          row.customerName,
          formatTime(row.startTime),
          endText,
          csvHours(row.durationSeconds),
          "",
          "",
          "",
        ]),
      );
    }
    lines.push(
      csvLine([
        summary.day,
        "Tageszusammenfassung",
        "",
        "",
        "",
        "",
        csvHours(summary.standardSeconds),
        csvHours(summary.projectSeconds),
        csvHours(summary.unassignedSeconds),
      ]),
    );
  }

  return lines.join("\r\n");
}
