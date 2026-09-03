import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDashboardRedirect } from "./redirect-target.ts";

for (const target of [
  "/dashboard", "/dashboard/history", "/dashboard/history?from=2026-01-01#chart",
  "/auth/desktop-complete",
]) {
  test(`normalizeDashboardRedirect allows ${target}`, () => {
    assert.equal(normalizeDashboardRedirect(target), target);
  });
}

for (const target of ["/auth/desktop-complete/", "/auth/desktop-complete/x", "/auth/desktop-completeish"]) {
  test(`normalizeDashboardRedirect rejects near-miss ${target}`, () => {
    assert.equal(normalizeDashboardRedirect(target), "/dashboard");
  });
}

for (const target of [
  null, "", "https://evil.example/dashboard", "//evil.example/dashboard",
  "%2F%2Fevil.example/dashboard", "%252F%252Fevil.example/dashboard",
  "javascript:alert(1)", "data:text/html,evil", "/dashboard\\@evil.example",
  "/dashboard/%2e%2e/login", "/login", "/dashboardish", "/%zz",
]) {
  test(`normalizeDashboardRedirect rejects ${String(target)}`, () => {
    assert.equal(normalizeDashboardRedirect(target), "/dashboard");
  });
}
