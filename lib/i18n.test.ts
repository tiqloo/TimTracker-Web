// Tests for lib/i18n.ts's pure lookup/interpolation helpers (Ticket 022),
// same "node --test, no framework" convention as lib/format.chart.test.ts
// and lib/pdf/history-export-paginator.test.ts — these are the only
// functions in this file with actual logic; the dictionary consts
// themselves are plain data, not worth asserting on individually.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emailChangeSuccessMessage,
  historyChartAriaLabel,
  historyChartTooltip,
  t,
  trialDaysRemainingParts,
  type Translated,
} from "./i18n.ts";

test("t: looks up the requested language on a Translated entry", () => {
  const entry: Translated = { de: "Historie", en: "History" };
  assert.equal(t("de", entry), "Historie");
  assert.equal(t("en", entry), "History");
});

test("trialDaysRemainingParts: German uses a leading 'Noch', English has no prefix word", () => {
  assert.deepEqual(trialDaysRemainingParts("de", 5), { before: "Noch", after: "Tage Testphase." });
  assert.deepEqual(trialDaysRemainingParts("en", 5), { before: "", after: "days left in trial." });
});

test("trialDaysRemainingParts: singular 'Tag'/'day' at exactly 1, plural otherwise", () => {
  assert.equal(trialDaysRemainingParts("de", 1).after, "Tag Testphase.");
  assert.equal(trialDaysRemainingParts("de", 0).after, "Tage Testphase.");
  assert.equal(trialDaysRemainingParts("de", 2).after, "Tage Testphase.");
  assert.equal(trialDaysRemainingParts("en", 1).after, "day left in trial.");
  assert.equal(trialDaysRemainingParts("en", 0).after, "days left in trial.");
  assert.equal(trialDaysRemainingParts("en", 2).after, "days left in trial.");
});

test("historyChartAriaLabel: mentions the correct granularity in each language", () => {
  assert.match(historyChartAriaLabel("de", "day"), /pro Tag$/);
  assert.match(historyChartAriaLabel("de", "month"), /pro Monat$/);
  assert.match(historyChartAriaLabel("en", "day"), /per day$/);
  assert.match(historyChartAriaLabel("en", "month"), /per month$/);
});

test("historyChartTooltip: interpolates the bar label and both durations", () => {
  assert.equal(
    historyChartTooltip("de", "24.08.", "2h 00m", "1h 30m"),
    "24.08.: Automatik 2h 00m, Projekt 1h 30m",
  );
  assert.equal(
    historyChartTooltip("en", "24.08.", "2h 00m", "1h 30m"),
    "24.08.: Automatic 2h 00m, Project 1h 30m",
  );
});

// Ticket 025 (TimTracker-Starter repo) — the AK's required success copy
// names BOTH addresses and states the change isn't yet effective.
test("emailChangeSuccessMessage: names both addresses and states neither is confirmed yet", () => {
  const de = emailChangeSuccessMessage("de", "old@example.com", "new@example.com");
  assert.match(de, /old@example\.com/);
  assert.match(de, /new@example\.com/);
  assert.match(de, /erst nach Bestätigung beider wirksam/);

  const en = emailChangeSuccessMessage("en", "old@example.com", "new@example.com");
  assert.match(en, /old@example\.com/);
  assert.match(en, /new@example\.com/);
  assert.match(en, /only takes effect once both are confirmed/);
});
