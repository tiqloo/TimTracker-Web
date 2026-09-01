import assert from "node:assert/strict";
import test from "node:test";
import { collectAllPages } from "./pagination.ts";

test("collectAllPages: uses inclusive, gap-free page ranges until the final short page", async () => {
  const calls: Array<[number, number]> = [];
  const source = Array.from({ length: 2_001 }, (_, index) => index);

  const result = await collectAllPages(async (from, to) => {
    calls.push([from, to]);
    return source.slice(from, to + 1);
  }, 1_000);

  assert.deepEqual(calls, [[0, 999], [1_000, 1_999], [2_000, 2_999]]);
  assert.deepEqual(result, source);
});

test("collectAllPages: an exact full page requests one final empty page", async () => {
  const calls: Array<[number, number]> = [];
  const source = [1, 2];

  const result = await collectAllPages(async (from, to) => {
    calls.push([from, to]);
    return source.slice(from, to + 1);
  }, 2);

  assert.deepEqual(calls, [[0, 1], [2, 3]]);
  assert.deepEqual(result, source);
});

test("collectAllPages: propagates a later page error instead of returning partial data", async () => {
  await assert.rejects(
    collectAllPages(async (from) => {
      if (from === 0) return [1, 2];
      throw new Error("page failed");
    }, 2),
    /page failed/,
  );
});

test("collectAllPages: rejects invalid page sizes before fetching", async () => {
  let called = false;
  await assert.rejects(
    collectAllPages(async () => {
      called = true;
      return [];
    }, 0),
    RangeError,
  );
  assert.equal(called, false);
});

for (const rowCount of [0, 1, 999, 1_000, 1_001, 3_507]) {
  test(`collectAllPages: returns all ${rowCount} rows`, async () => {
    const source = Array.from({ length: rowCount }, (_, index) => index);
    const result = await collectAllPages(
      async (from, to) => source.slice(from, to + 1),
      1_000,
    );
    assert.deepEqual(result, source);
  });
}
