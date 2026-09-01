import { test } from "node:test";
import assert from "node:assert/strict";
import { errorRecovery, languageFromDocument } from "./error-recovery.ts";

test("languageFromDocument recognizes English locale variants", () => {
  assert.equal(languageFromDocument("en"), "en");
  assert.equal(languageFromDocument("en-US"), "en");
  assert.equal(languageFromDocument("EN-gb"), "en");
});

test("languageFromDocument safely falls back to German", () => {
  assert.equal(languageFromDocument("de-DE"), "de");
  assert.equal(languageFromDocument("fr"), "de");
  assert.equal(languageFromDocument(null), "de");
});

test("recovery copy is complete in both supported languages", () => {
  for (const entry of Object.values(errorRecovery)) {
    assert.ok(entry.de.trim());
    assert.ok(entry.en.trim());
  }
});

