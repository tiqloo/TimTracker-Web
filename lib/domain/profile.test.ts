// lib/domain/profile.ts had zero test coverage despite backing
// DashboardNav's identity display on every dashboard page. In particular,
// emailLocalPart's own comment claims an unconditional correctness
// guarantee for the no-"@" edge case ("should not happen for a real
// Supabase user, but keeps this total rather than throwing") that no test
// actually exercised — found via the same "comment claim vs. test"
// technique used throughout this session (see e.g.
// 060-e2e-ui-edge-case-suite.md).
import assert from "node:assert/strict";
import test from "node:test";
import { displayNameOrFallback, emailLocalPart, normalizeDisplayNameInput, type Profile } from "./profile.ts";

test("emailLocalPart returns the part before '@'", () => {
  assert.equal(emailLocalPart("max@example.com"), "max");
  assert.equal(emailLocalPart("a.b+tag@sub.example.co"), "a.b+tag");
});

test("emailLocalPart falls back to the full string when there is no '@'", () => {
  assert.equal(emailLocalPart("not-an-email"), "not-an-email");
  assert.equal(emailLocalPart(""), "");
});

test("displayNameOrFallback prefers a set display name over the email", () => {
  const profile: Profile = { email: "max@example.com", displayName: "Max Mustermann", createdAt: "2026-01-01T00:00:00Z", avatarPath: null, onboardingIntent: null };
  assert.equal(displayNameOrFallback(profile), "Max Mustermann");
});

test("displayNameOrFallback falls back to the email's local part when displayName is null", () => {
  const profile: Profile = { email: "max@example.com", displayName: null, createdAt: "2026-01-01T00:00:00Z", avatarPath: null, onboardingIntent: null };
  assert.equal(displayNameOrFallback(profile), "max");
});

test("displayNameOrFallback falls back to the full email when it has no '@' (defensive edge case)", () => {
  const profile: Profile = { email: "not-an-email", displayName: null, createdAt: "2026-01-01T00:00:00Z", avatarPath: null, onboardingIntent: null };
  assert.equal(displayNameOrFallback(profile), "not-an-email");
});

test("normalizeDisplayNameInput trims surrounding whitespace", () => {
  assert.equal(normalizeDisplayNameInput("  Max Mustermann  "), "Max Mustermann");
});

test("normalizeDisplayNameInput treats an empty or whitespace-only value as null, not as ''", () => {
  assert.equal(normalizeDisplayNameInput(""), null);
  assert.equal(normalizeDisplayNameInput("   "), null);
  assert.equal(normalizeDisplayNameInput("\t\n "), null);
});
