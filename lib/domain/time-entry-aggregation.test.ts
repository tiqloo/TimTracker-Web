import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyBreakdowns,
  PAUSE_PROJECT_ID,
  STANDARD_PROJECT_ID,
  timeEntryDurationSeconds,
  unionSeconds,
} from "./time-entry-aggregation.ts";
import type { TimeEntry } from "./time-entry.ts";

function entry(
  id: string,
  projectId: string,
  day: string,
  startTime: string,
  endTime: string | null,
): TimeEntry {
  return {
    id,
    projectId,
    day,
    startTime,
    endTime,
    source: "manual",
    note: null,
    updatedAt: startTime,
  };
}

test("timeEntryDurationSeconds uses the shared snapshot time for running entries", () => {
  const running = entry(
    "running",
    STANDARD_PROJECT_ID,
    "2026-08-01",
    "2026-08-01T08:00:00.000Z",
    null,
  );
  assert.equal(timeEntryDurationSeconds(running, new Date("2026-08-01T10:00:00.000Z")), 7200);
});

test("buildDailyBreakdowns groups, sorts and separates work, projects and pauses", () => {
  const entries = [
    entry("pause", PAUSE_PROJECT_ID, "2026-08-02", "2026-08-02T10:00:00Z", "2026-08-02T10:15:00Z"),
    entry("standard", STANDARD_PROJECT_ID, "2026-08-01", "2026-08-01T08:00:00Z", "2026-08-01T09:00:00Z"),
    entry("project", "project-1", "2026-08-01", "2026-08-01T09:00:00Z", "2026-08-01T11:00:00Z"),
  ];

  assert.deepEqual(buildDailyBreakdowns(entries, new Date("2026-08-03T00:00:00Z")), [
    {
      day: "2026-08-01",
      standardSeconds: 3600,
      projectSeconds: 7200,
      pauseSeconds: 0,
      totalSeconds: 10800,
      unassignedSeconds: 3600,
    },
    {
      day: "2026-08-02",
      standardSeconds: 0,
      projectSeconds: 0,
      pauseSeconds: 900,
      totalSeconds: 0,
      unassignedSeconds: 0,
    },
  ]);
});

test("old running entries stop at the next Berlin midnight", () => {
  const winter = entry(
    "winter",
    STANDARD_PROJECT_ID,
    "2026-01-01",
    "2026-01-01T22:00:00Z",
    null,
  );
  const summer = entry(
    "summer",
    STANDARD_PROJECT_ID,
    "2026-07-01",
    "2026-07-01T20:00:00Z",
    null,
  );
  assert.equal(timeEntryDurationSeconds(winter, new Date("2026-01-03T12:00:00Z")), 3600);
  assert.equal(timeEntryDurationSeconds(summer, new Date("2026-07-03T12:00:00Z")), 7200);
});

// Ticket 118 — the SAME entry's end-of-day clamp must genuinely depend on
// an explicitly passed workspace timezone, not silently keep using the
// PRODUCT_TIME_ZONE (Berlin) default regardless of what's passed in.
test("timeEntryDurationSeconds uses an explicitly passed workspace timezone instead of the Berlin default", () => {
  const winter = entry(
    "winter",
    STANDARD_PROJECT_ID,
    "2026-01-01",
    "2026-01-01T22:00:00Z",
    null,
  );
  const now = new Date("2026-01-03T12:00:00Z");
  assert.equal(timeEntryDurationSeconds(winter, now, "Europe/Berlin"), 3600);
  assert.equal(timeEntryDurationSeconds(winter, now, "America/New_York"), 25200);
});

// Same "no day skipped/duplicated across the discontinuity" property as
// calendar-day.test.ts's own DST tests, but exercised through the
// aggregation layer's end-of-day clamp specifically, for a workspace
// timezone OTHER than the hardcoded Berlin default — an entry left
// running into the next calendar day, with "now" observed on the far side
// of that timezone's own DST transition, must still clamp to exactly that
// timezone's real local midnight instant.
test("unionSeconds' end-of-day clamp is correct across a non-Berlin DST transition", () => {
  // Sydney's 2026 spring-forward is 2026-10-03T15:00Z (02:00 -> 03:00
  // local) — an entry from 2026-10-03 left running clamps at Sydney's next
  // midnight (2026-10-04 00:00 local = 2026-10-03T14:00Z, still AEST/+10,
  // one hour before that day's own transition).
  const runningIntoDst = entry(
    "running-into-dst",
    STANDARD_PROJECT_ID,
    "2026-10-03",
    "2026-10-03T10:00:00Z",
    null,
  );
  const now = new Date("2026-10-05T00:00:00Z");
  assert.equal(unionSeconds([runningIntoDst], now, "Australia/Sydney"), 4 * 3600);
});

test("negative durations clamp to zero and overlaps count as their union, not an additive sum", () => {
  const invalid = entry(
    "invalid",
    STANDARD_PROJECT_ID,
    "2026-08-01",
    "2026-08-01T10:00:00Z",
    "2026-08-01T09:00:00Z",
  );
  assert.equal(timeEntryDurationSeconds(invalid, new Date("2026-08-01T12:00:00Z")), 0);

  // Ticket 086: 08:00-10:00 and 09:00-11:00 overlap from 09:00-10:00 — real
  // wall-clock coverage is 08:00-11:00 (3h = 10800s), not the additive 4h
  // (2h + 2h) this test used to assert before the union fix.
  const overlapping = [
    entry("a", "project-1", "2026-08-01", "2026-08-01T08:00:00Z", "2026-08-01T10:00:00Z"),
    entry("b", "project-1", "2026-08-01", "2026-08-01T09:00:00Z", "2026-08-01T11:00:00Z"),
  ];
  assert.equal(buildDailyBreakdowns(overlapping, new Date("2026-08-01T12:00:00Z"))[0]?.totalSeconds, 10800);
});

test("three overlapping entries in the same category merge as a single chained union (A-B, B-C, A and C not directly overlapping)", () => {
  const chained = [
    entry("a", "project-1", "2026-08-01", "2026-08-01T08:00:00Z", "2026-08-01T10:00:00Z"),
    entry("b", "project-1", "2026-08-01", "2026-08-01T09:30:00Z", "2026-08-01T11:00:00Z"),
    entry("c", "project-1", "2026-08-01", "2026-08-01T10:30:00Z", "2026-08-01T12:00:00Z"),
  ];
  // Union of 08:00-10:00, 09:30-11:00, 10:30-12:00 is one continuous
  // 08:00-12:00 span (4h = 14400s), even though A (08:00-10:00) and C
  // (10:30-12:00) never directly overlap each other.
  assert.equal(
    buildDailyBreakdowns(chained, new Date("2026-08-01T13:00:00Z"))[0]?.projectSeconds,
    14400,
  );
});

test("an entry fully contained within another counts the outer span once, not doubled", () => {
  const nested = [
    entry("outer", "project-1", "2026-08-01", "2026-08-01T08:00:00Z", "2026-08-01T12:00:00Z"),
    entry("inner", "project-1", "2026-08-01", "2026-08-01T09:00:00Z", "2026-08-01T10:00:00Z"),
  ];
  assert.equal(
    buildDailyBreakdowns(nested, new Date("2026-08-01T13:00:00Z"))[0]?.projectSeconds,
    14400,
  );
});

test("exactly adjacent entries (end of A equals start of B) are not treated as overlapping and still sum in full", () => {
  const adjacent = [
    entry("a", "project-1", "2026-08-01", "2026-08-01T08:00:00Z", "2026-08-01T09:00:00Z"),
    entry("b", "project-1", "2026-08-01", "2026-08-01T09:00:00Z", "2026-08-01T10:00:00Z"),
  ];
  assert.equal(
    buildDailyBreakdowns(adjacent, new Date("2026-08-01T13:00:00Z"))[0]?.projectSeconds,
    7200,
  );
});

test("overlaps ACROSS categories do not reduce either category's own total (Ticket 086: option (a) — union per category, not cross-category)", () => {
  const crossCategory = [
    entry("project", "project-1", "2026-08-01", "2026-08-01T08:00:00Z", "2026-08-01T10:00:00Z"),
    entry("pause", PAUSE_PROJECT_ID, "2026-08-01", "2026-08-01T09:00:00Z", "2026-08-01T09:30:00Z"),
  ];
  const [breakdown] = buildDailyBreakdowns(crossCategory, new Date("2026-08-01T13:00:00Z"));
  // The pause entry overlaps the project entry from 09:00-09:30, but each
  // category is unioned separately — project keeps its full 2h, pause keeps
  // its full 30min, neither is subtracted from the other.
  assert.equal(breakdown?.projectSeconds, 7200);
  assert.equal(breakdown?.pauseSeconds, 1800);
});
