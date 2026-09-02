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
