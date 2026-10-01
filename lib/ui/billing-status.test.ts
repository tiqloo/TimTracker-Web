import assert from "node:assert/strict";
import test from "node:test";
import { getBillingStatusPresentation } from "./billing-status.ts";

test("active and trial subscriptions receive a positive status treatment", () => {
  assert.deepEqual(getBillingStatusPresentation("active"), {
    tone: "success",
    periodLabel: "nextRenewalOn",
  });
  assert.deepEqual(getBillingStatusPresentation("trialing"), {
    tone: "success",
    periodLabel: "trialEndsOn",
  });
});

test("payment problems are highlighted without presenting them as active", () => {
  for (const status of ["past_due", "unpaid"] as const) {
    assert.equal(getBillingStatusPresentation(status).tone, "warning");
    assert.equal(getBillingStatusPresentation(status).periodLabel, "accessEndedOn");
  }
});

test("inactive states stay visually neutral", () => {
  for (const status of ["canceled", "incomplete_expired", "none"] as const) {
    assert.equal(getBillingStatusPresentation(status).tone, "neutral");
    assert.equal(getBillingStatusPresentation(status).periodLabel, "accessEndedOn");
  }
});
