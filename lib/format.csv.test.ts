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

// Ticket 147: CSV-/Formel-Injection (CWE-1236) — a malicious project or
// customer name must never reach the exported file with a leading
// formula-trigger character, since the export is typically opened by a
// third party (accounting, a client), not just the person who named the
// project.
test("formatHistoryCsv: a project name starting with '=' is neutralized with a leading apostrophe", () => {
  const maliciousRow: ExportRow = { ...row, projectName: '=HYPERLINK("http://evil.example";"Click")' };
  const csv = formatHistoryCsv([maliciousRow], [summary]);
  const dataLine = csv.split("\r\n")[1];
  assert.ok(!dataLine.includes(';=HYPERLINK'), `formula must not appear unguarded: ${dataLine}`);
  assert.ok(dataLine.includes(";'=HYPERLINK") || dataLine.includes(';"\'=HYPERLINK'), `expected a leading apostrophe guard: ${dataLine}`);
});

test("formatHistoryCsv: customer names starting with other formula-trigger characters are neutralized", () => {
  for (const trigger of ["+", "-", "@", "\tcmd"]) {
    const maliciousRow: ExportRow = { ...row, customerName: `${trigger}SUM(1)` };
    const csv = formatHistoryCsv([maliciousRow], [summary]);
    const dataLine = csv.split("\r\n")[1];
    assert.ok(!dataLine.includes(`;${trigger}SUM(1)`), `trigger character '${trigger}' must be neutralized: ${dataLine}`);
  }
});

test("formatHistoryCsv: ordinary field values are unaffected by the formula guard", () => {
  const csv = formatHistoryCsv([row], [summary]);
  const dataLine = csv.split("\r\n")[1];
  assert.ok(dataLine.includes("Seed-Projekt"));
  assert.ok(dataLine.includes("Testkunde GmbH"));
});

// escapeCsvField's quoting guard only checked for ';', '"', and '\n' —
// not '\r', even though '\r' is itself one of the formula-trigger
// characters and rows are joined with "\r\n". A field containing a raw,
// embedded '\r' (e.g. pasted from a Classic-Mac or Windows-formatted
// clipboard) got the leading-apostrophe guard but stayed unquoted — many
// CSV parsers (Excel, Numbers) treat a lone '\r' as a line terminator and
// would break the row structure mid-field, independent of the formula
// question.
test("formatHistoryCsv: a field containing a raw carriage return is quoted", () => {
  const rowWithCr: ExportRow = { ...row, projectName: "Zeile1\rZeile2" };
  const csv = formatHistoryCsv([rowWithCr], [summary]);
  assert.ok(csv.includes('"Zeile1\rZeile2"'), `expected the field to be quoted: ${JSON.stringify(csv)}`);
});
