import assert from "node:assert/strict";
import test from "node:test";
import { parseTheme } from "./theme.ts";

test("theme parser accepts supported preferences", () => {
  assert.equal(parseTheme("system"), "system");
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("dark"), "dark");
});

test("theme parser safely falls back to system", () => {
  assert.equal(parseTheme(null), "system");
  assert.equal(parseTheme("unknown"), "system");
});
