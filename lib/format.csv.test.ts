// Tests for formatHistoryCsv's optional `projectFilterLabel` parameter
// (Ticket 043 — Historie calendar + project filter), same "node --test, no
// framework" convention as lib/format.test.ts/lib/format.chart.test.ts.
// Focus: an unfiltered export's CSV shape stays byte-for-byte unchanged
// (no regression for the pre-existing, most common case), and a filtered
// export gets exactly one extra informational line before the real header
// row, using the same semicolon-delimited/escaped shape as every other
// line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHistoryCsv } from "./format.ts";
import type { ExportRow } from "./domain/export-row.ts";
import type { DailyBreakdown } from "./domain/time-entry.ts";

const summary: DailyBreakdown = {
  day: "2026-08-24",
  standardSeconds: 3600,
  projectSeconds: 1800,
  pauseSeconds: 0,
  totalSeconds: 5400,
  unassignedSeconds: 0,
};

const row: ExportRow = {
  id: "1",
  day: "2026-08-24",
  projectName: "Seed-Projekt",
  customerName: "Testkunde GmbH",
  startTime: "2026-08-24T09:00:00Z",
  endTime: "2026-08-24T09:30:00Z",
  durationSeconds: 1800,
  isRunning: false,
};

test("formatHistoryCsv: without a project filter, the header row is still the very first line (unchanged shape)", () => {
  const csv = formatHistoryCsv([row], [summary]);
  const firstLine = csv.split("\r\n")[0];
  assert.equal(firstLine, "Datum;Projekt;Kunde;Start;Ende;Dauer (h);Automatikzeit (h);Projektzeit (h);Nicht zugeordnet (h)");
});

test("formatHistoryCsv: with a project filter, one extra info line precedes the header row", () => {
  const csv = formatHistoryCsv([row], [summary], "Seed-Projekt");
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Projekt-Filter;Seed-Projekt");
  assert.equal(lines[1], "Datum;Projekt;Kunde;Start;Ende;Dauer (h);Automatikzeit (h);Projektzeit (h);Nicht zugeordnet (h)");
});

test("formatHistoryCsv: an empty projectFilterLabel is treated the same as no filter (no extra line)", () => {
  const csv = formatHistoryCsv([row], [summary], "");
  const firstLine = csv.split("\r\n")[0];
  assert.equal(firstLine, "Datum;Projekt;Kunde;Start;Ende;Dauer (h);Automatikzeit (h);Projektzeit (h);Nicht zugeordnet (h)");
});

test("formatHistoryCsv: a project name containing the ';' delimiter is quoted/escaped like any other field", () => {
  const csv = formatHistoryCsv([row], [summary], 'Kunde A; Projekt "X"');
  const firstLine = csv.split("\r\n")[0];
  assert.equal(firstLine, 'Projekt-Filter;"Kunde A; Projekt ""X"""');
});
