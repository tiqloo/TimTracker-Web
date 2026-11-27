import assert from "node:assert/strict";
import test from "node:test";
import { withRequestMemo } from "./request-memo.ts";

function fakeRepository() {
  const calls: string[] = [];
  let settingsVersion = 1;
  let failNext = false;
  const repository = {
    async getSettings(workspaceId: string) {
      calls.push(`getSettings:${workspaceId}`);
      if (failNext) {
        failNext = false;
        throw new Error("transient");
      }
      return { workspaceId, version: settingsVersion };
    },
    async getUserId() {
      calls.push("getUserId");
      return "user-1";
    },
    async updateSettings(workspaceId: string) {
      calls.push(`updateSettings:${workspaceId}`);
      settingsVersion += 1;
    },
    name: "fake",
  };
  return { repository, calls, failOnce: () => (failNext = true) };
}

test("#56: a memoized read runs once per argument set", async () => {
  const { repository, calls } = fakeRepository();
  const memo = withRequestMemo(repository, ["getSettings", "getUserId"]);

  const [a, b] = await Promise.all([memo.getSettings("w1"), memo.getSettings("w1")]);
  await memo.getSettings("w1");
  await memo.getSettings("w2");
  await memo.getUserId();
  await memo.getUserId();

  assert.deepEqual(a, b);
  assert.deepEqual(calls, ["getSettings:w1", "getSettings:w2", "getUserId"]);
});

test("#56: any other method call (a write) clears the memo", async () => {
  const { repository, calls } = fakeRepository();
  const memo = withRequestMemo(repository, ["getSettings"]);

  assert.equal((await memo.getSettings("w1")).version, 1);
  await memo.updateSettings("w1");
  assert.equal((await memo.getSettings("w1")).version, 2, "after a write the next read must hit the database again");
  assert.deepEqual(calls, ["getSettings:w1", "updateSettings:w1", "getSettings:w1"]);
});

test("#56: a failed read is not cached", async () => {
  const { repository, calls, failOnce } = fakeRepository();
  const memo = withRequestMemo(repository, ["getSettings"]);

  failOnce();
  await assert.rejects(memo.getSettings("w1"));
  assert.equal((await memo.getSettings("w1")).version, 1);
  assert.deepEqual(calls, ["getSettings:w1", "getSettings:w1"]);
});

test("#56: non-function properties pass through unchanged", () => {
  const { repository } = fakeRepository();
  const memo = withRequestMemo(repository, ["getSettings"]);
  assert.equal(memo.name, "fake");
});
