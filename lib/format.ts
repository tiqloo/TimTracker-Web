// Pure formatting helpers — no side effects, no data access, so this
// lives outside lib/application/* (which is reserved for use cases that
// take a Repositories argument) and outside lib/domain/* (which holds
// models + business rules, not display formatting). Safe to import from
// both Server and Client Components.
import type { ExportRow } from "@/lib/domain/export-row";
import type { DailyBreakdown } from "@/lib/domain/time-entry";
import { resolveHistoryDateRange } from "./domain/calendar-day.ts";

// Mirrors TimeFormatter.shortDurationString(from:) in
// Shared/Helpers/TimeFormatter.swift (TimTracker-Starter) — same
// underlying Math.floor/Math.max Xh Ym / Ym shape and value for the EN
// case (English keeps the compact native-app-matching form), so the web
// and native apps show duration identically for the same underlying
// seconds value in English. `locale` defaults to "de-DE", same convention
// and default as formatDayLabel/formatFullDate below (this call site's
// existing behavior for every current caller, unchanged) — added as a
// parameter, not hardcoded, because unlike those two this function used
// to have no language awareness at all (Ticket 038): it always rendered
// the English "h"/"m" suffixes even under a German locale. A German
// locale now renders "6 h 42 min" instead of "6h 42m" — spaced-out
// unit words, the conventional German duration notation (vs. the
// terse English abbreviation directly against the number) — while every
// other locale keeps the original compact EN shape unchanged.
export function formatDuration(seconds: number, locale: string = "de-DE"): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (locale.startsWith("de")) {
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// "14:32" in the viewer's local time zone — used for time-entry start/end
// times in the flat "Heute" list. `locale` defaults to "de-DE" (this call
// site's existing behavior for every current caller, unchanged) — added
// as a parameter instead of the previously hardcoded "de-DE" (Ticket 038)
// so a caller resolving the visitor's language preference can render
// English-locale time formatting too, same pattern as formatDayLabel/
// formatFullDate below.
//
// Ticket 188 (selbst gefunden): `timeFormat` ergänzt (Ticket 117s
// Workspace-Einstellung "Zeitformat", 24h/12h — bislang gespeichert, aber
// nirgends beim Rendern gelesen). Ohne explizites `hour12` liefert
// `toLocaleTimeString("en-US", ...)` JS' eigenen 12h/AM-PM-Default für
// diese Locale — unabhängig davon, was der Nutzer in den
// Workspace-Einstellungen tatsächlich gewählt hat. `timeFormat` (nicht
// `locale`) entscheidet jetzt allein über 12h/24h, exakt wie die
// Einstellungsseite es dem Nutzer verspricht ("24-Stunden (14:30)" /
// "12-Stunden (2:30 PM)"); `locale` bleibt nur noch für eventuelle
// Ziffern-/Trennzeichen-Konventionen relevant. Literal `"24h" | "12h"`
// statt eines Imports aus lib/repositories/* — diese Datei bleibt bewusst
// abhängigkeitsfrei von der Repository-Schicht, siehe Datei-Kommentar
// oben; `WorkspaceTimeFormat` (lib/application/workspace.ts) ist
// strukturell derselbe Typ.
export function formatTime(isoDateTime: string, locale: string = "de-DE", timeFormat: "24h" | "12h" = "24h"): string {
  return new Date(isoDateTime).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
}

// Ticket 195 ("Zeiteinträge manuell bearbeiten/löschen/nachtragen"): the
// browser's own local wall-clock reading of an ISO instant, zero-padded
// 24h, suitable as an `<input type="time">` value — the HTML spec
// requires that exact "HH:mm" shape for the value attribute regardless of
// display locale/timeFormat, so this deliberately does NOT reuse
// formatTime above (a locale-/hour12-aware *display* string, not a valid
// input value). Same "browser's own local timezone, not a workspace IANA
// timezone" convention formatTime already relies on implicitly (no
// `timeZone` option passed to `toLocale*` anywhere in this file) — a
// workspace's members are assumed to actually be in that timezone, same
// reasoning Ticket 118 applied only to DAY-BOUNDARY math, never to what
// numeral a clock face shows a viewer.
export function toTimeInputValue(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Inverse of toTimeInputValue, combined with a day (`yyyy-MM-dd`) — same
// local-time parsing convention formatDayLabel above already uses (no "Z"
// suffix, so JS interprets the literal as the browser's own local time),
// so a value read via toTimeInputValue() and written back through this
// function round-trips to the exact same instant.
export function fromDayAndTimeInput(day: string, hhmm: string): string {
  return new Date(`${day}T${hhmm}:00`).toISOString();
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

// Ticket 188 (selbst gefunden, Folge-Fund): `weekStart` ergänzt — Ticket
// 117s Workspace-Einstellung "Wochenbeginn" (Montag/Sonntag, gespeichert
// über `update_workspace_settings`) hatte genau wie `timeFormat` bislang
// keinen einzigen Aufrufer, der sie tatsächlich las; jede "Diese
// Woche"-Berechnung (History-/Analytics-Preset, Heutes
// Wochenvergleich) war fest auf Montag verdrahtet. Literal
// `"monday" | "sunday"` statt eines Imports aus lib/repositories/* —
// dieselbe bewusste Abhängigkeitsfreiheit wie `formatTime`s
// `timeFormat`-Parameter oben; `WeekStart` (lib/application/workspace.ts)
// ist strukturell derselbe Typ.
export function startOfWeekIso(isoDay: string, weekStart: "monday" | "sunday" = "monday"): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  const weekday = date.getUTCDay(); // 0 = Sunday
  const diffToStart =
    weekStart === "sunday" ? -weekday : weekday === 0 ? -6 : 1 - weekday;
  return addDaysIso(isoDay, diffToStart);
}

export function startOfMonthIso(isoDay: string): string {
  return `${isoDay.slice(0, 7)}-01`;
}

// Added for the "Dieses Jahr" history preset (Ticket 002) — same
// string-slicing style as startOfMonthIso above, no Date object involved.
export function startOfYearIso(isoDay: string): string {
  return `${isoDay.slice(0, 4)}-01-01`;
}

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
  return resolveHistoryDateRange(today, params);
}

// --- "Historie" bar chart (Ticket 002) ---------------------------------
//
// Pure aggregation over an already-fetched DailyBreakdown[] (the same
// getHistory() result history/page.tsx already lists) into per-bar chart
// data. Lives here, not in lib/application/dashboard.ts, for the same
// reason formatHistoryCsv does: it's a pure transform of already-fetched
// data with no Repositories dependency, so it doesn't belong in the
// application core — and it must stay reusable from the Server Component
// that also builds the flat day list, without a second data fetch.

export type ChartGranularity = "day" | "month";

// Beyond this many days in the selected range, one bar per day becomes
// both unreadable (label crowding) and needlessly many SVG elements, so
// the chart aggregates into one bar per month instead. 62 (~2 months)
// keeps every existing preset that should show daily bars — "Diese
// Woche" (7 days), "Dieser Monat" (<=31), "Letzte 30 Tage" (30), and any
// hand-picked range up to about two months — on daily granularity, while
// "Dieses Jahr" (up to 366 days) and any longer custom range always fall
// back to monthly bars. This is what keeps the year view performant and
// readable per Ticket 002's edge case ("Sehr langer Zeitraum (Jahr)
// bleibt performant und übersichtlich") — it must never render one bar
// per day for a full year.
const DAILY_GRANULARITY_MAX_DAYS = 62;

// UTC-anchored on purpose, same pattern as addDaysIso/startOfWeekIso
// above — this is date arithmetic (a day count), not display, so
// anchoring to a fixed offset instead of the viewer's local zone keeps
// it deterministic regardless of where the code runs, immune to DST.
function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function resolveChartGranularity(from: string, to: string): ChartGranularity {
  return daysBetweenIso(from, to) > DAILY_GRANULARITY_MAX_DAYS ? "month" : "day";
}

export interface ChartBar {
  key: string; // "yyyy-MM-dd" (day granularity) or "yyyy-MM" (month granularity)
  label: string; // short axis label
  standardSeconds: number;
  projectSeconds: number;
}

const MONTH_LABELS_DE = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

// The chart's day/month labels are built by slicing the already-normalized
// "yyyy-MM-dd" / "yyyy-MM" ISO strings directly — deliberately NO `Date`
// object is constructed anywhere in this section. `new Date("2026-08-24")`
// (a date-only string, no time component) parses as UTC midnight in every
// JS engine, so calling `.getDate()`/`.getDay()`/`.toLocaleDateString()`
// on it can silently print the *previous* calendar day in any timezone
// west of UTC (or the next one, east of it) — exactly the class of bug
// Ticket 002's DST/timezone edge case warns against, and exactly what
// bit `formatDayLabel` above (fixed by anchoring to local midnight
// instead). Slicing the string sidesteps the whole bug class rather than
// trying to get Date-parsing/timezone anchoring right for a chart axis
// label, so it also can't regress if this file's other Date usage ever
// changes. Verified explicitly for a spread of dates, including both
// 2026 DST transitions (2026-03-29, 2026-10-25) and both year
// boundaries, in lib/format.chart.test.ts.
function dayOfMonthPart(isoDay: string): string {
  return isoDay.slice(8, 10);
}
function monthPart(isoDayOrMonth: string): string {
  return isoDayOrMonth.slice(5, 7);
}

export function formatShortDayLabel(isoDay: string): string {
  return `${dayOfMonthPart(isoDay)}.${monthPart(isoDay)}.`;
}

export function formatMonthLabel(isoMonth: string): string {
  const index = Number(monthPart(isoMonth)) - 1;
  return MONTH_LABELS_DE[index] ?? isoMonth;
}

// Pure "yyyy-MM" successor — plain integer arithmetic on the sliced
// year/month, no Date object, so it can't be affected by DST either.
function nextMonthIso(isoMonth: string): string {
  const year = Number(isoMonth.slice(0, 4));
  const month = Number(isoMonth.slice(5, 7)); // 1-12
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

// Builds one bar per day (or per month, at month granularity) across the
// full [from, to] range, filling in zero-activity days/months instead of
// leaving a gap — Ticket 002 AK: "Tage ohne Aktivität zeigen einen
// 0-Balken statt einer Lücke". `breakdowns` is the already-fetched
// getHistory() result (sparse — only days with at least one entry come
// back from the repository); order doesn't matter, this indexes it into
// a Map first.
export function buildChartBars(
  breakdowns: DailyBreakdown[],
  from: string,
  to: string,
  granularity: ChartGranularity,
): ChartBar[] {
  if (granularity === "day") {
    const byDay = new Map(breakdowns.map((b) => [b.day, b] as const));
    const bars: ChartBar[] = [];
    for (let day = from; day <= to; day = addDaysIso(day, 1)) {
      const b = byDay.get(day);
      bars.push({
        key: day,
        label: formatShortDayLabel(day),
        standardSeconds: b?.standardSeconds ?? 0,
        projectSeconds: b?.projectSeconds ?? 0,
      });
    }
    return bars;
  }

  const byMonth = new Map<string, { standardSeconds: number; projectSeconds: number }>();
  for (const b of breakdowns) {
    const key = b.day.slice(0, 7);
    const acc = byMonth.get(key) ?? { standardSeconds: 0, projectSeconds: 0 };
    acc.standardSeconds += b.standardSeconds;
    acc.projectSeconds += b.projectSeconds;
    byMonth.set(key, acc);
  }

  const toMonth = to.slice(0, 7);
  const bars: ChartBar[] = [];
  for (let month = from.slice(0, 7); month <= toMonth; month = nextMonthIso(month)) {
    const acc = byMonth.get(month);
    bars.push({
      key: month,
      label: formatMonthLabel(month),
      standardSeconds: acc?.standardSeconds ?? 0,
      projectSeconds: acc?.projectSeconds ?? 0,
    });
  }
  return bars;
}

// Flat CSV export for "Historie": one row per session plus one daily
// summary row per day, semicolon-delimited (German Excel splits columns
// correctly on ";" because "," is its decimal separator) — same shape as
// CSVExporter.swift's makeCSV(rows:dailySummaries:), including its exact
// column set and the "läuft noch" marker for a still-running entry, so a
// user comparing an export from the web app and the native app sees the
// same thing. Pure (rows/summaries already fetched by the caller), so it
// lives here rather than in lib/application/*.
//
// Below, formatTime() is deliberately called with NO locale argument
// (keeping its "de-DE" default) even after Ticket 038 added the
// parameter — export CONTENT stays German-only regardless of UI language,
// same scope precedent as the native app's Ticket 004/015 ("läuft noch",
// the German column headers below, etc. don't switch with the language
// picker either). Threading the UI locale through here would make this
// one row's start/end time formatting inconsistent with every other
// German-fixed label in this function.
const CSV_DELIMITER = ";";

// Ticket 147: CSV-/Formel-Injection (CWE-1236). projectName/customerName
// are free, user-controlled text (see lib/application/projects.ts — only
// trims/checks length, no character restriction). Without this guard, a
// project or customer name like `=HYPERLINK("http://evil.example";"Click")`
// would be interpreted as a formula the moment the exported file is opened
// in Excel/Numbers/LibreCalc/Sheets — genuinely dangerous here since
// exports are typically handed to a third party (accounting, a client), not
// just opened by the user who created the name. A leading apostrophe forces
// text interpretation in every mainstream spreadsheet app without changing
// the visible cell content. Applied to every field (not just
// project/customer name) as defense in depth — simpler and more robust
// against a future export column than a per-field decision.
const FORMULA_TRIGGER_CHARACTERS = /^[=+\-@\t\r]/;

function escapeCsvField(field: string): string {
  const guarded = FORMULA_TRIGGER_CHARACTERS.test(field) ? `'${field}` : field;
  // '\r' must trigger quoting too, not just ';'/'"'/'\n' — rows are joined
  // with "\r\n" below, and a raw, embedded '\r' left unquoted (e.g. pasted
  // from a Classic-Mac or Windows-formatted clipboard) would look like a
  // line terminator to many CSV parsers (Excel, Numbers), breaking the row
  // structure mid-field regardless of the formula-injection question.
  if (!/[;"\n\r]/.test(guarded)) return guarded;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function csvHours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

function csvLine(fields: string[]): string {
  return fields.map(escapeCsvField).join(CSV_DELIMITER);
}

// `projectFilterLabel` (Ticket 043 — Historie calendar + project filter):
// optional project NAME (not id), purely informational. `rows`/`summaries`
// are already fetched pre-filtered by the caller (getExportRows/getHistory
// already take the projectId, see lib/application/export.ts) — this
// function doesn't filter anything itself, it only surfaces which filter
// produced the data it's given, as one extra line before the real header
// row, so a reader opening the file later still knows it's a partial
// export rather than "all activity in this period". Omitted entirely (no
// extra line) when no filter is active, so an unfiltered export's CSV
// shape is byte-for-byte unchanged from before this ticket.
export function formatHistoryCsv(
  rows: ExportRow[],
  summaries: DailyBreakdown[],
  projectFilterLabel?: string,
): string {
  const rowsByDay = new Map<string, ExportRow[]>();
  for (const row of rows) {
    const bucket = rowsByDay.get(row.day) ?? [];
    bucket.push(row);
    rowsByDay.set(row.day, bucket);
  }

  const lines: string[] = [];
  if (projectFilterLabel) {
    lines.push(csvLine(["Projekt-Filter", projectFilterLabel]));
  }
  lines.push(
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
  );

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
