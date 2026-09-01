import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDailyGoalProgress,
  normalizeDailyGoalHoursInput,
} from "./daily-goal.ts";

test("daily goal normalization clears invalid values and clamps excessive input", () => {
  for (const value of [Number.NaN, Number.NEGATIVE_INFINITY, 0, -1]) {
    assert.equal(normalizeDailyGoalHoursInput(value), null);
  }
  assert.equal(normalizeDailyGoalHoursInput(7.5), 7.5);
  assert.equal(normalizeDailyGoalHoursInput(80), 24);
});

test("daily goal progress clamps both bounds and marks reached goals", () => {
  assert.equal(computeDailyGoalProgress(100, null), null);
  assert.equal(computeDailyGoalProgress(100, 0), null);
  assert.deepEqual(computeDailyGoalProgress(-100, 8), {
    goalSeconds: 28_800,
    ratio: 0,
    reached: false,
  });
  assert.deepEqual(computeDailyGoalProgress(30_000, 8), {
    goalSeconds: 28_800,
    ratio: 1,
    reached: true,
  });
});
