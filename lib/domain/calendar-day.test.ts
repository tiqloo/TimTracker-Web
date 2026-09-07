import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDayInTimeZone,
  InvalidHistoryRangeError,
  isValidIsoCalendarDay,
  resolveHistoryDateRange,
} from "./calendar-day.ts";

test("isValidIsoCalendarDay validates real month ends and leap years", () => {
  for (const day of ["2024-02-29", "2026-02-28", "2026-04-30", "2026-12-31"]) {
    assert.equal(isValidIsoCalendarDay(day), true, day);
  }
  for (const day of ["2026-02-29", "2026-02-31", "2026-04-31", "2026-00-10", "2026-13-01", "2026-1-01"]) {
    assert.equal(isValidIsoCalendarDay(day), false, day);
  }
});

test("calendarDayInTimeZone uses Berlin's local day around midnight", () => {
  assert.equal(calendarDayInTimeZone(new Date("2026-01-01T22:59:59Z")), "2026-01-01");
  assert.equal(calendarDayInTimeZone(new Date("2026-01-01T23:00:00Z")), "2026-01-02");
  assert.equal(calendarDayInTimeZone(new Date("2026-07-01T21:59:59Z")), "2026-07-01");
  assert.equal(calendarDayInTimeZone(new Date("2026-07-01T22:00:00Z")), "2026-07-02");
});

test("calendarDayInTimeZone remains correct across Berlin DST transitions", () => {
  assert.equal(calendarDayInTimeZone(new Date("2026-03-29T00:30:00Z")), "2026-03-29");
  assert.equal(calendarDayInTimeZone(new Date("2026-03-29T01:30:00Z")), "2026-03-29");
  assert.equal(calendarDayInTimeZone(new Date("2026-10-25T00:30:00Z")), "2026-10-25");
  assert.equal(calendarDayInTimeZone(new Date("2026-10-25T01:30:00Z")), "2026-10-25");
});

// Ticket 118 — calendarDayInTimeZone's `timeZone` param already existed
// (used internally by time-entry-aggregation.ts's own now-configurable
// callers); these confirm it genuinely generalizes beyond the Berlin
// default, including a Southern-Hemisphere DST transition (Sydney's own
// "spring forward" falls in October, opposite Berlin's March/October
// pattern) — a workspace's chosen timezone isn't guaranteed to be
// European.
test("calendarDayInTimeZone works for an arbitrary non-default IANA zone", () => {
  assert.equal(calendarDayInTimeZone(new Date("2026-01-01T04:59:59Z"), "America/New_York"), "2025-12-31");
  assert.equal(calendarDayInTimeZone(new Date("2026-01-01T05:00:00Z"), "America/New_York"), "2026-01-01");
});

test("calendarDayInTimeZone remains correct across a Southern-Hemisphere DST transition (Sydney)", () => {
  // Sydney's 2026 spring-forward (AEST -> AEDT) happens at 2026-10-03T15:00Z
  // (02:00 local becomes 03:00 local) — both instants below straddle that
  // moment but must report the SAME calendar day, same "no day skipped/
  // duplicated across the discontinuity" proof as the Berlin test above.
  assert.equal(calendarDayInTimeZone(new Date("2026-10-03T14:30:00Z"), "Australia/Sydney"), "2026-10-04");
  assert.equal(calendarDayInTimeZone(new Date("2026-10-03T15:30:00Z"), "Australia/Sydney"), "2026-10-04");
});

test("resolveHistoryDateRange defaults missing values but validates explicit dates", () => {
  assert.deepEqual(resolveHistoryDateRange("2026-09-01", {}), {
    from: "2026-08-03",
    to: "2026-09-01",
  });
  assert.deepEqual(resolveHistoryDateRange("2026-09-01", { from: "2026-08-01" }), {
    from: "2026-08-01",
    to: "2026-09-01",
  });
  assert.throws(
    () => resolveHistoryDateRange("2026-09-01", { from: "2026-02-31", to: "2026-03-01" }),
    InvalidHistoryRangeError,
  );
});

test("resolveHistoryDateRange rejects reversed, future and oversized ranges", () => {
  for (const params of [
    { from: "2026-09-01", to: "2026-08-01" },
    { from: "2026-08-01", to: "2026-09-02" },
    { from: "2025-08-31", to: "2026-09-01" },
  ]) {
    assert.throws(() => resolveHistoryDateRange("2026-09-01", params), InvalidHistoryRangeError);
  }
  assert.deepEqual(
    resolveHistoryDateRange("2026-09-01", { from: "2025-09-01", to: "2026-09-01" }),
    { from: "2025-09-01", to: "2026-09-01" },
  );
});
