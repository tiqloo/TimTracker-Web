import { test } from "node:test";
import assert from "node:assert/strict";
import {
  errorFeedbackProps,
  successFeedbackProps,
  warningFeedbackProps,
} from "./feedback.ts";

test("errors use an assertive alert live region", () => {
  assert.deepEqual(errorFeedbackProps, {
    role: "alert",
    "aria-live": "assertive",
  });
});

test("success feedback uses a polite status live region", () => {
  assert.deepEqual(successFeedbackProps, {
    role: "status",
    "aria-live": "polite",
  });
});

test("non-blocking warnings use a polite status live region", () => {
  assert.deepEqual(warningFeedbackProps, {
    role: "status",
    "aria-live": "polite",
  });
});
