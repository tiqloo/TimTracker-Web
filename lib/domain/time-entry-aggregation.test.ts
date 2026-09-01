import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyBreakdowns,
  PAUSE_PROJECT_ID,
  STANDARD_PROJECT_ID,
  timeEntryDurationSeconds,
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

test("negative durations clamp to zero and overlaps remain explicit additive segments", () => {
  const invalid = entry(
    "invalid",
    STANDARD_PROJECT_ID,
    "2026-08-01",
    "2026-08-01T10:00:00Z",
    "2026-08-01T09:00:00Z",
  );
  assert.equal(timeEntryDurationSeconds(invalid, new Date("2026-08-01T12:00:00Z")), 0);

  const overlapping = [
    entry("a", "project-1", "2026-08-01", "2026-08-01T08:00:00Z", "2026-08-01T10:00:00Z"),
    entry("b", "project-1", "2026-08-01", "2026-08-01T09:00:00Z", "2026-08-01T11:00:00Z"),
  ];
  assert.equal(buildDailyBreakdowns(overlapping, new Date("2026-08-01T12:00:00Z"))[0]?.totalSeconds, 14400);
});
