// Tests for formatDuration/formatTime's locale parameter (Ticket 038),
// same "node --test, no framework" convention as lib/format.chart.test.ts
// and lib/i18n.test.ts. Focus: the German-vs-English format branch and
// that the default ("de-DE") and the pre-existing EN compact shape are
// both exactly right, plus the two edge cases the ticket calls out (0
// seconds, very long durations).
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatTime, fromDayAndTimeInput, startOfWeekIso, toTimeInputValue } from "./format.ts";

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

test("formatTime: renders 24h HH:MM by default (timeFormat='24h'), regardless of locale", () => {
  const iso = "2026-08-24T08:34:00Z";
  // Compare against the locale's own toLocaleTimeString output for the
  // same Date/options rather than a hardcoded clock string, so this test
  // doesn't depend on (and isn't broken by) the runner's local timezone.
  // `hour12: false` here is the actual claim this test's own name makes —
  // Ticket 188 (selbst gefunden): without it, this same computation for
  // "en-US" silently matches JS' own 12h/AM-PM default for that locale,
  // so the previous version of this test passed while formatTime() itself
  // rendered "02:34 AM" for English users — a real regression this test
  // was supposed to (but didn't) catch. `timeFormat` (not `locale`) is
  // now the actual source of truth for 12h/24h, mirroring Ticket 117's
  // "Zeitformat" workspace setting — this test covers its "24h" default.
  const expectedDefault = new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const expectedDe = new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const expectedEn = new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  assert.equal(formatTime(iso), expectedDefault);
  assert.equal(formatTime(iso, "de-DE"), expectedDe);
  assert.equal(formatTime(iso, "en-US"), expectedEn);
  // The actual cross-platform guarantee that matters (Ticket 188): the
  // SAME instant renders IDENTICALLY regardless of UI language, matching
  // the native Mac app's TimeFormatter.timeOfDayString, which never
  // varies by locale either.
  assert.equal(formatTime(iso, "de-DE"), formatTime(iso, "en-US"));
  assert.doesNotMatch(formatTime(iso, "en-US"), /AM|PM/);
});

test("formatTime: renders 12h AM/PM when the workspace's timeFormat setting is '12h'", () => {
  // Ticket 188 (selbst gefunden) — Ticket 117's "Zeitformat" workspace
  // setting was persisted (update_workspace_settings) but never actually
  // consulted anywhere time-of-day was rendered; this pins the branch
  // that closes that gap. 08:34 UTC either shows a leading-zero morning
  // hour or an afternoon one depending on the runner's local timezone —
  // assert against the locale's own computation (same pattern as above)
  // rather than a hardcoded literal, and separately assert the one thing
  // that must always hold regardless of timezone: an AM/PM marker present.
  const iso = "2026-08-24T08:34:00Z";
  const expected = new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  assert.equal(formatTime(iso, "de-DE", "12h"), expected);
  assert.match(formatTime(iso, "de-DE", "12h"), /AM|PM/i);
  assert.match(formatTime(iso, "en-US", "12h"), /AM|PM/i);
});

// Ticket 195 ("Zeiteinträge manuell bearbeiten/löschen/nachtragen") —
// toTimeInputValue/fromDayAndTimeInput power the new edit/create forms'
// <input type="time"> fields. Both computed against the runner's own
// local timezone (same convention as formatTime's own tests above) rather
// than a hardcoded literal, so this suite stays green regardless of which
// timezone CI/a contributor's machine happens to run in.
test("toTimeInputValue: renders zero-padded 24h HH:mm in the local timezone, never locale-/AM-PM-formatted", () => {
  const iso = "2026-08-24T08:05:00Z";
  const local = new Date(iso);
  const expected = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
  assert.equal(toTimeInputValue(iso), expected);
  assert.doesNotMatch(toTimeInputValue(iso), /AM|PM/i);
});

test("fromDayAndTimeInput: round-trips with toTimeInputValue for the same local instant", () => {
  const iso = "2026-08-24T08:05:00Z";
  const day = "2026-08-24";
  const hhmm = toTimeInputValue(iso);
  // The round-trip must land on the exact same minute it started from —
  // this is the actual guarantee the edit form depends on: opening an
  // entry, not touching the time fields, and saving must be a no-op.
  const roundTripped = fromDayAndTimeInput(day, hhmm);
  assert.equal(toTimeInputValue(roundTripped), hhmm);
});

test("fromDayAndTimeInput: two different HH:mm inputs on the same day produce a later instant for the later time", () => {
  const earlier = fromDayAndTimeInput("2026-08-24", "08:00");
  const later = fromDayAndTimeInput("2026-08-24", "17:30");
  assert.ok(new Date(later).getTime() > new Date(earlier).getTime());
});

// Ticket 188 (selbst gefunden, Folge-Fund) — Ticket 117's "Wochenbeginn"
// workspace setting had the exact same "saved but never read" bug as
// timeFormat: every "this week" computation was hardcoded to
// Monday-start regardless of this setting.
test("startOfWeekIso: defaults to Monday-start when no weekStart is given", () => {
  // 2026-08-24 is itself a Monday.
  assert.equal(startOfWeekIso("2026-08-24"), "2026-08-24");
  assert.equal(startOfWeekIso("2026-08-27"), "2026-08-24"); // Thursday -> that week's Monday
  assert.equal(startOfWeekIso("2026-08-23"), "2026-08-17"); // Sunday -> the PRECEDING Monday, not itself
});

test("startOfWeekIso: explicit weekStart='monday' matches the default", () => {
  assert.equal(startOfWeekIso("2026-08-27", "monday"), "2026-08-24");
  assert.equal(startOfWeekIso("2026-08-23", "monday"), "2026-08-17");
});

test("startOfWeekIso: weekStart='sunday' treats Sunday as the week's own first day", () => {
  // Same reference days as the Monday-start test above, so the two
  // conventions' actual difference is directly visible: Thursday's week
  // now starts one day earlier (Sunday the 23rd, not Monday the 24th),
  // and Sunday itself is now the start of ITS OWN week, not the tail end
  // of the previous one.
  assert.equal(startOfWeekIso("2026-08-27", "sunday"), "2026-08-23"); // Thursday -> that week's Sunday
  assert.equal(startOfWeekIso("2026-08-23", "sunday"), "2026-08-23"); // Sunday is its own week's start
  assert.equal(startOfWeekIso("2026-08-24", "sunday"), "2026-08-23"); // Monday -> the PRECEDING Sunday
});
