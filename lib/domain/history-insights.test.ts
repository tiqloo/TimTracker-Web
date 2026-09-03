import assert from "node:assert/strict";
import test from "node:test";
import { buildHistorySummary, buildProjectTimeTotals } from "./history-insights.ts";
import type { DailyBreakdown, TimeEntry } from "./time-entry.ts";
import type { Project } from "./project.ts";

const projects: Project[] = [
  { id: "p1", name: "Alpha", colorHex: "7A6FB4", customer: "", notes: "", isDefault: false, isArchived: false, updatedAt: "2026-09-01T00:00:00Z" },
  { id: "p2", name: "Beta", colorHex: "4C8FBF", customer: "", notes: "", isDefault: false, isArchived: false, updatedAt: "2026-09-01T00:00:00Z" },
];

function entry(id: string, projectId: string, start: string, end: string): TimeEntry {
  return { id, projectId, day: "2026-09-01", startTime: start, endTime: end, source: "manual", note: null, updatedAt: end };
}

test("history insights aggregate projects and calculate percentages", () => {
  const totals = buildProjectTimeTotals([
    entry("a", "p1", "2026-09-01T08:00:00Z", "2026-09-01T10:00:00Z"),
    entry("b", "p2", "2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z"),
    entry("system", "00000000-0000-0000-0000-000000000001", "2026-09-01T11:00:00Z", "2026-09-01T12:00:00Z"),
  ], projects, new Date("2026-09-02T00:00:00Z"));

  assert.deepEqual(totals.map(({ id, seconds, percentage }) => ({ id, seconds, percentage })), [
    { id: "p1", seconds: 7200, percentage: 2 / 3 },
    { id: "p2", seconds: 3600, percentage: 1 / 3 },
  ]);
});

test("Ticket 086: overlapping entries for the same project count their union, not an additive sum", () => {
  const totals = buildProjectTimeTotals([
    entry("a", "p1", "2026-09-01T08:00:00Z", "2026-09-01T10:00:00Z"),
    entry("b", "p1", "2026-09-01T09:00:00Z", "2026-09-01T11:00:00Z"),
  ], projects, new Date("2026-09-02T00:00:00Z"));

  // Union of 08:00-10:00 and 09:00-11:00 is 08:00-11:00 (3h = 10800s), not
  // the additive 4h (2h + 2h) a plain per-entry sum would give.
  assert.deepEqual(totals.map(({ id, seconds }) => ({ id, seconds })), [
    { id: "p1", seconds: 10800 },
  ]);
});

test("history summary averages only active days", () => {
  const breakdowns: DailyBreakdown[] = [
    { day: "2026-09-01", standardSeconds: 0, projectSeconds: 7200, pauseSeconds: 0, totalSeconds: 7200, unassignedSeconds: 0 },
    { day: "2026-09-02", standardSeconds: 0, projectSeconds: 0, pauseSeconds: 0, totalSeconds: 0, unassignedSeconds: 0 },
  ];
  const summary = buildHistorySummary(breakdowns, [{ id: "p1", name: "Alpha", colorHex: "7A6FB4", seconds: 7200, percentage: 1 }]);
  assert.deepEqual(summary, { totalSeconds: 7200, averageSecondsPerActiveDay: 7200, projectCount: 1 });
});

