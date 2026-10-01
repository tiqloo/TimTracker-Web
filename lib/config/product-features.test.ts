import assert from "node:assert/strict";
import test from "node:test";
import {
  disabledWorkspaceFeatureRedirect,
  isWorkspaceOnlyPath,
  productFeatures,
  resolveProductFeatures,
} from "./product-features.ts";

test("personal mode is the safe default and workspace mode is explicit", () => {
  assert.deepEqual(resolveProductFeatures(undefined), {
    mode: "personal",
    workspaceAndTeam: false,
    organizationRegistration: false,
    invitations: false,
  });
  assert.equal(resolveProductFeatures("workspace").workspaceAndTeam, true);
  assert.equal(resolveProductFeatures("anything-else").workspaceAndTeam, false);
});

test("workspace-only routes are recognized without blocking personal routes", () => {
  for (const path of [
    "/register/company",
    "/invite/accept",
    "/dashboard/team-times",
    "/dashboard/overview",
    "/dashboard/company-analytics",
    "/dashboard/workspaces/new",
    "/dashboard/workspaces/id/members",
  ]) assert.equal(isWorkspaceOnlyPath(path), true, path);

  for (const path of ["/register", "/dashboard", "/dashboard/history", "/dashboard/projects", "/dashboard/analytics"]) {
    assert.equal(isWorkspaceOnlyPath(path), false, path);
  }
});

test("personal mode redirects direct organization URLs but leaves personal URLs alone", () => {
  Object.assign(productFeatures, resolveProductFeatures("personal"));
  assert.equal(disabledWorkspaceFeatureRedirect("/register/company", false), "/register");
  assert.equal(disabledWorkspaceFeatureRedirect("/invite/accept", true), "/dashboard");
  assert.equal(disabledWorkspaceFeatureRedirect("/dashboard/workspaces/acme/members", true), "/dashboard");
  assert.equal(disabledWorkspaceFeatureRedirect("/dashboard/history", true), null);
});
