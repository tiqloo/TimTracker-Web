// Tests for formatDuration/formatTime's locale parameter (Ticket 038),
// same "node --test, no framework" convention as lib/format.chart.test.ts
// and lib/i18n.test.ts. Focus: the German-vs-English format branch and
// that the default ("de-DE") and the pre-existing EN compact shape are
// both exactly right, plus the two edge cases the ticket calls out (0
// seconds, very long durations).
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatTime } from "./format.ts";

test("formatDuration: German locale uses spaced-out 'h'/'min' words", () => {
  assert.equal(formatDuration(0, "de-DE"), "0 min");
  assert.equal(formatDuration(95, "de-DE"), "1 min"); // 95s -> floor(95/60) = 1 minute
  assert.equal(formatDuration(3700, "de-DE"), "1 h 1 min"); // 3700s -> 1h01m
  assert.equal(formatDuration(6 * 3600 + 42 * 60, "de-DE"), "6 h 42 min");
});

test("formatDuration: defaults to the German format when no locale is passed", () => {
  assert.equal(formatDuration(3700), "1 h 1 min");
});

test("formatDuration: English locale keeps the original compact 'h'/'m' shape unchanged", () => {
  assert.equal(formatDuration(0, "en-US"), "0m");
  assert.equal(formatDuration(95, "en-US"), "1m");
  assert.equal(formatDuration(3700, "en-US"), "1h 1m");
  assert.equal(formatDuration(6 * 3600 + 42 * 60, "en-US"), "6h 42m");
});

test("formatDuration: 0 seconds renders a readable zero value, not an empty string, in either locale", () => {
  assert.equal(formatDuration(0, "de-DE"), "0 min");
  assert.equal(formatDuration(0, "en-US"), "0m");
});

test("formatDuration: negative input clamps to zero instead of going negative", () => {
  assert.equal(formatDuration(-100, "de-DE"), "0 min");
  assert.equal(formatDuration(-100, "en-US"), "0m");
});

test("formatDuration: very long durations (> 24h, e.g. a yearly aggregate) don't overflow or break", () => {
  const oneYearSeconds = 365 * 24 * 3600 + 42 * 60; // 8760h 42min
  assert.equal(formatDuration(oneYearSeconds, "de-DE"), "8760 h 42 min");
  assert.equal(formatDuration(oneYearSeconds, "en-US"), "8760h 42m");
});

test("formatTime: renders 24h HH:MM in the requested locale, defaulting to de-DE", () => {
  const iso = "2026-08-24T08:34:00Z";
  // Compare against the locale's own toLocaleTimeString output for the
  // same Date/options rather than a hardcoded clock string, so this test
  // doesn't depend on (and isn't broken by) the runner's local timezone.
  const expectedDefault = new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const expectedDe = new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const expectedEn = new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  assert.equal(formatTime(iso), expectedDefault);
  assert.equal(formatTime(iso, "de-DE"), expectedDe);
  assert.equal(formatTime(iso, "en-US"), expectedEn);
});
