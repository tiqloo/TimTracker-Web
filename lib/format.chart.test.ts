// Tests for the "Historie" bar chart's pure aggregation logic (Ticket
// 002), run with Node's built-in test runner (`node --test`) — no new
// dependency (no vitest/jest in this repo yet; adding a full test
// framework for one file of pure functions would be disproportionate,
// see the ticket's testing notes). Node 22+ strips TypeScript types
// natively, so this file runs directly, no build step.
//
// Focus: the exact timezone/DST edge case Ticket 002 calls out — that
// day-bucketing/labeling must not reintroduce a UTC-vs-local shift bug
// (e.g. `new Date("2026-08-24").getDay()`, which parses as UTC midnight
// and can print the wrong calendar day depending on the runtime's local
// timezone). buildChartBars/formatShortDayLabel/formatMonthLabel are
// deliberately implemented with zero `Date` object construction (pure
// string slicing) specifically to avoid that bug class — these tests
// verify that decision holds, including across both 2026 DST
// transitions and a year boundary, and are timezone-independent
// themselves (assert on structure/labels only, no local-Date reads).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildChartBars,
  formatMonthLabel,
  formatShortDayLabel,
  resolveChartGranularity,
} from "./format.ts";
import type { DailyBreakdown } from "./domain/time-entry.ts";

function breakdown(day: string, standardSeconds: number, projectSeconds: number): DailyBreakdown {
  return {
    day,
    standardSeconds,
    projectSeconds,
    pauseSeconds: 0,
    totalSeconds: standardSeconds + projectSeconds,
    unassignedSeconds: Math.max(0, standardSeconds - projectSeconds),
  };
}

test("formatShortDayLabel: no off-by-one across DST transitions or year boundaries", () => {
  // 2026 DST start (Germany, 2026-03-29) and end (2026-10-25), plus
  // 2025-12-31/2026-01-01 (year boundary) and the first/last day of a
  // 31-day month. A Date-parsing bug (UTC midnight vs. local timezone)
  // would shift exactly these boundary dates by one day in some
  // timezones — pure string slicing must not.
  assert.equal(formatShortDayLabel("2026-03-29"), "29.03.");
  assert.equal(formatShortDayLabel("2026-03-30"), "30.03.");
  assert.equal(formatShortDayLabel("2026-10-25"), "25.10.");
  assert.equal(formatShortDayLabel("2026-10-26"), "26.10.");
  assert.equal(formatShortDayLabel("2025-12-31"), "31.12.");
  assert.equal(formatShortDayLabel("2026-01-01"), "01.01.");
  assert.equal(formatShortDayLabel("2026-01-31"), "31.01.");
});

test("formatMonthLabel: correct month name at both year ends, no Date parsing", () => {
  assert.equal(formatMonthLabel("2026-01"), "Jan");
  assert.equal(formatMonthLabel("2026-12"), "Dez");
  assert.equal(formatMonthLabel("2026-08"), "Aug");
});

test("resolveChartGranularity: day for week/month-sized ranges, month for year-sized ranges", () => {
  assert.equal(resolveChartGranularity("2026-08-21", "2026-08-27"), "day"); // week
  assert.equal(resolveChartGranularity("2026-08-01", "2026-08-31"), "day"); // month
  assert.equal(resolveChartGranularity("2026-01-01", "2026-12-31"), "month"); // year
  assert.equal(resolveChartGranularity("2026-01-01", "2026-08-27"), "month"); // "Dieses Jahr" so far
});

test("buildChartBars (day granularity): one bar per calendar day, zero-fill for missing days, no gaps", () => {
  const breakdowns = [breakdown("2026-08-24", 3600, 1800)]; // only one day has data
  const bars = buildChartBars(breakdowns, "2026-08-22", "2026-08-25", "day");

  assert.equal(bars.length, 4); // 22, 23, 24, 25 inclusive
  assert.deepEqual(
    bars.map((b) => b.key),
    ["2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25"],
  );
  // Zero-activity days are present as real entries (0-bar), not omitted
  // (a gap) — Ticket 002 AK.
  assert.deepEqual(bars[0], {
    key: "2026-08-22",
    label: "22.08.",
    standardSeconds: 0,
    projectSeconds: 0,
  });
  assert.deepEqual(bars[2], {
    key: "2026-08-24",
    label: "24.08.",
    standardSeconds: 3600,
    projectSeconds: 1800,
  });
});

test("buildChartBars (day granularity): correctly buckets across a DST transition", () => {
  // 2026-03-29 is the Germany DST start date. A UTC-vs-local bug could
  // either drop or duplicate a day here.
  const bars = buildChartBars([], "2026-03-27", "2026-03-31", "day");
  assert.deepEqual(
    bars.map((b) => b.key),
    ["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"],
  );
});

test("buildChartBars (month granularity): aggregates daily data into monthly bars, one bar per month, no gaps", () => {
  const breakdowns = [
    breakdown("2026-01-05", 1000, 500),
    breakdown("2026-01-20", 2000, 0),
    // February has no activity at all — must still produce a 0-bar, not
    // be skipped.
    breakdown("2026-03-01", 0, 300),
  ];
  const bars = buildChartBars(breakdowns, "2026-01-01", "2026-03-31", "month");

  assert.deepEqual(
    bars.map((b) => b.key),
    ["2026-01", "2026-02", "2026-03"],
  );
  assert.deepEqual(
    bars.map((b) => b.label),
    ["Jan", "Feb", "Mär"],
  );

  // Sum-of-daily-data-equals-monthly-bar: January's bar must equal the
  // sum of both January entries, not just one of them.
  assert.deepEqual(bars[0], {
    key: "2026-01",
    label: "Jan",
    standardSeconds: 1000 + 2000,
    projectSeconds: 500 + 0,
  });
  // February: zero-fill, not omitted.
  assert.deepEqual(bars[1], {
    key: "2026-02",
    label: "Feb",
    standardSeconds: 0,
    projectSeconds: 0,
  });
  assert.deepEqual(bars[2], {
    key: "2026-03",
    label: "Mär",
    standardSeconds: 0,
    projectSeconds: 300,
  });
});

test("buildChartBars (month granularity): a full year produces 12 bars, never 365 daily bars", () => {
  const breakdowns: DailyBreakdown[] = [];
  for (let month = 1; month <= 12; month++) {
    const mm = String(month).padStart(2, "0");
    breakdowns.push(breakdown(`2026-${mm}-15`, 3600, 1800));
  }
  const bars = buildChartBars(breakdowns, "2026-01-01", "2026-12-31", "month");
  assert.equal(bars.length, 12);
  assert.equal(
    bars.every((b) => b.standardSeconds === 3600 && b.projectSeconds === 1800),
    true,
  );
});
