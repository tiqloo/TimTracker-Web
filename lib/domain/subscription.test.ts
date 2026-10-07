import assert from "node:assert/strict";
import test from "node:test";
import { canManageInBillingPortal, canUseApp } from "./subscription.ts";

const now = new Date("2026-09-01T12:00:00Z");

test("subscription gate allows only active or trialing, non-expired access", () => {
  assert.equal(canUseApp({ status: "active", currentPeriodEnd: null }, now), true);
  assert.equal(canUseApp({ status: "trialing", currentPeriodEnd: "2026-09-01T12:00:01Z" }, now), true);
  assert.equal(canUseApp({ status: "active", currentPeriodEnd: "2026-09-01T12:00:00Z" }, now), false);
  assert.equal(canUseApp({ status: "active", currentPeriodEnd: "2026-09-01T11:59:59Z" }, now), false);
  for (const status of ["past_due", "canceled", "unpaid", "incomplete_expired", "none"] as const) {
    assert.equal(canUseApp({ status, currentPeriodEnd: "2099-01-01T00:00:00Z" }, now), false);
  }
});

test("subscription gate fails closed for an invalid period end", () => {
  assert.equal(canUseApp({ status: "active", currentPeriodEnd: "not-a-date" }, now), false);
});

// Only a paying subscription is guaranteed to have a Stripe customer; the
// billing portal is unreachable for everyone else (create-portal-session
// answers 409), so they get checkout instead — same rule as the Mac app.
test("billing portal is offered only for an active subscription", () => {
  assert.equal(canManageInBillingPortal({ status: "active", currentPeriodEnd: null }), true);
  for (const status of ["trialing", "past_due", "canceled", "unpaid", "incomplete_expired", "none"] as const) {
    assert.equal(canManageInBillingPortal({ status, currentPeriodEnd: null }), false);
  }
});
