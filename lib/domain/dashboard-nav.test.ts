import assert from "node:assert/strict";
import test from "node:test";
import { resolveManagementLinkIds, resolveNavLinkIds } from "./dashboard-nav.ts";

test("resolveNavLinkIds: PERSONAL always gets the full flat list regardless of role", () => {
  const expected = ["today", "history", "analytics", "projects", "support", "settings"];
  assert.deepEqual(resolveNavLinkIds("PERSONAL", "owner"), expected);
  assert.deepEqual(resolveNavLinkIds("PERSONAL", "member"), expected);
  assert.deepEqual(resolveNavLinkIds("PERSONAL", undefined), expected);
});

test("resolveNavLinkIds: ORGANIZATION owner/admin see teamTimes + employees + overview, member does not", () => {
  for (const role of ["owner", "admin"] as const) {
    const ids = resolveNavLinkIds("ORGANIZATION", role);
    assert.ok(ids.includes("teamTimes"), `${role} should see teamTimes`);
    assert.ok(ids.includes("employees"), `${role} should see employees`);
    assert.ok(ids.includes("overview"), `${role} should see overview`);
  }
  const memberIds = resolveNavLinkIds("ORGANIZATION", "member");
  assert.ok(!memberIds.includes("teamTimes"));
  assert.ok(!memberIds.includes("employees"));
  assert.ok(!memberIds.includes("overview"));
});

test("resolveNavLinkIds: ORGANIZATION never includes settings in the main row (moved to the account dropdown)", () => {
  assert.ok(!resolveNavLinkIds("ORGANIZATION", "owner").includes("settings"));
  assert.ok(!resolveNavLinkIds("ORGANIZATION", "member").includes("settings"));
});

test("resolveManagementLinkIds: only ORGANIZATION owner/admin get invitations/workspaceSettings/billing", () => {
  assert.deepEqual(resolveManagementLinkIds("ORGANIZATION", "owner"), [
    "invitations",
    "workspaceSettings",
    "billing",
  ]);
  assert.deepEqual(resolveManagementLinkIds("ORGANIZATION", "admin"), [
    "invitations",
    "workspaceSettings",
    "billing",
  ]);
  assert.deepEqual(resolveManagementLinkIds("ORGANIZATION", "member"), []);
  assert.deepEqual(resolveManagementLinkIds("PERSONAL", "owner"), []);
});
