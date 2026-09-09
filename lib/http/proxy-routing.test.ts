import assert from "node:assert/strict";
import test from "node:test";
import {
  isProtectedPath,
  shouldRedirectAuthenticatedUser,
  shouldValidateHistoryRange,
} from "./proxy-routing.ts";

test("proxy protection covers the dashboard namespace plus the company-onboarding step", () => {
  for (const path of ["/dashboard", "/dashboard/history", "/dashboard/settings/export/data", "/register/company"]) {
    assert.equal(isProtectedPath(path), true, path);
  }
  for (const path of ["/", "/login", "/register", "/reset-password", "/dashboardish", "/register/companyish", "/register/company/x"]) {
    assert.equal(isProtectedPath(path), false, path);
  }
});

test("authenticated users are redirected away from login and registration only", () => {
  assert.equal(shouldRedirectAuthenticatedUser("/login"), true);
  assert.equal(shouldRedirectAuthenticatedUser("/register"), true);
  assert.equal(shouldRedirectAuthenticatedUser("/reset-password"), false);
  assert.equal(shouldRedirectAuthenticatedUser("/login/help"), false);
});

test("proxy leaves export range errors to their Route Handler contract", () => {
  assert.equal(shouldValidateHistoryRange("/dashboard/history"), true);
  for (const path of [
    "/dashboard/history/2026-09-01",
    "/dashboard/history/export",
    "/dashboard/history/export/pdf",
    "/dashboard",
    "/dashboard/settings/export/data",
    "/dashboard/historyish",
    "/dashboard/history/exportevil",
  ]) {
    assert.equal(shouldValidateHistoryRange(path), false, path);
  }
});
