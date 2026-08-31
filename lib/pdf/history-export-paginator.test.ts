// Mirrors Tests/UnitTests/HistoryExportPaginatorTests.swift's coverage
// (overflow split, month-change split, empty input) for the TS port, run
// with Node's built-in test runner like lib/format.chart.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { paginateHistoryExport } from "./history-export-paginator.ts";
import type { DailyBreakdown } from "../domain/time-entry.ts";
import type { ExportRow } from "../domain/export-row.ts";

function breakdown(day: string): DailyBreakdown {
  return {
    day,
    standardSeconds: 3600,
    projectSeconds: 0,
    pauseSeconds: 0,
    totalSeconds: 3600,
    unassignedSeconds: 3600,
  };
}

function row(day: string, id: string): ExportRow {
  return {
    id,
    day,
    projectName: "Arbeitszeit",
    customerName: "–",
    startTime: `${day}T08:00:00.000Z`,
    endTime: `${day}T09:00:00.000Z`,
    durationSeconds: 3600,
    isRunning: false,
  };
}

test("paginateHistoryExport: empty period returns no pages", () => {
  assert.deepEqual(paginateHistoryExport([], []), []);
});

test("paginateHistoryExport: single day with no overflow stays on one page", () => {
  const summaries = [breakdown("2026-08-01")];
  const rows = [row("2026-08-01", "a")];
  const pages = paginateHistoryExport(rows, summaries, 26);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].length, 1);
  assert.equal(pages[0][0].rows.length, 1);
});

test("paginateHistoryExport: row-count overflow starts a new page", () => {
  // Each day chunk here is 6 rows + 1 summary row = 7; maxRowsPerPage=10
  // means the 2nd day chunk (would bring the running total to 14) must
  // start a new page.
  const summaries = [breakdown("2026-08-01"), breakdown("2026-08-02")];
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => row("2026-08-01", `a${i}`)),
    ...Array.from({ length: 6 }, (_, i) => row("2026-08-02", `b${i}`)),
  ];
  const pages = paginateHistoryExport(rows, summaries, 10);
  assert.equal(pages.length, 2);
  assert.equal(pages[0][0].day.day, "2026-08-01");
  assert.equal(pages[1][0].day.day, "2026-08-02");
});

test("paginateHistoryExport: calendar month change starts a new page even without overflow", () => {
  const summaries = [breakdown("2026-07-31"), breakdown("2026-08-01")];
  const rows = [row("2026-07-31", "a"), row("2026-08-01", "b")];
  const pages = paginateHistoryExport(rows, summaries, 26);
  assert.equal(pages.length, 2);
  assert.equal(pages[0][0].day.day, "2026-07-31");
  assert.equal(pages[1][0].day.day, "2026-08-01");
});

test("paginateHistoryExport: day chunks are sorted chronologically regardless of input order", () => {
  const summaries = [breakdown("2026-08-02"), breakdown("2026-08-01")];
  const rows = [row("2026-08-02", "a"), row("2026-08-01", "b")];
  const pages = paginateHistoryExport(rows, summaries, 26);
  assert.equal(pages.length, 1);
  assert.deepEqual(
    pages[0].map((c) => c.day.day),
    ["2026-08-01", "2026-08-02"],
  );
});
