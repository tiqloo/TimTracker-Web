import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ResourceNotFoundError } from "../../domain/application-error.ts";
import { createSupabaseProjectsRepository } from "./projects.repository.ts";
import { createSupabaseTimeEntriesRepository } from "./time-entries.repository.ts";
import { requireUpdatedRow } from "./mutation-result.ts";

function mutationClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const query = {
    update: () => query,
    eq: () => query,
    select: () => query,
    maybeSingle: async () => result,
  };
  return { from: () => query } as unknown as SupabaseClient;
}

// Ticket 103: rename/setArchived/updateProject never need the active
// workspace (they mutate one already-known row by id) — asserting this
// thunk is never even called here doubles as a regression check for that.
const neverCalled = async (): Promise<string> => {
  throw new Error("getActiveWorkspaceId should not be called by this method");
};

function assertBackendFailure(
  action: (client: SupabaseClient) => Promise<unknown>,
): Promise<void> {
  const backendError = new Error("database unavailable");
  return assert.rejects(
    action(mutationClient({ data: null, error: backendError })),
    (error: unknown) => error === backendError,
  );
}

test("requireUpdatedRow returns the row reported by PostgREST", () => {
  const row = { id: "project-1" };
  assert.equal(requireUpdatedRow(row, "Project"), row);
});

test("requireUpdatedRow rejects a zero-row update hidden by RLS", () => {
  assert.throws(
    () => requireUpdatedRow(null, "Project"),
    (error: unknown) =>
      error instanceof ResourceNotFoundError &&
      error.code === "RESOURCE_NOT_FOUND" &&
      error.httpStatus === 404,
  );
});

test("project rename rejects an update with zero visible rows", async () => {
  const repository = createSupabaseProjectsRepository(
    mutationClient({ data: null, error: null }),
    neverCalled,
  );
  await assert.rejects(
    repository.rename("missing", "Renamed", ""),
    ResourceNotFoundError,
  );
});

test("project archive rejects an update with zero visible rows", async () => {
  const repository = createSupabaseProjectsRepository(
    mutationClient({ data: null, error: null }),
    neverCalled,
  );
  await assert.rejects(
    repository.setArchived("missing", true),
    ResourceNotFoundError,
  );
});

test("time-entry assignment rejects an update with zero visible rows", async () => {
  const repository = createSupabaseTimeEntriesRepository(
    mutationClient({ data: null, error: null }),
    neverCalled,
  );
  await assert.rejects(
    repository.updateProject("missing", "project-1"),
    ResourceNotFoundError,
  );
});

test("project rename preserves backend failures", async () => {
  await assertBackendFailure((client) =>
    createSupabaseProjectsRepository(client, neverCalled).rename("project-1", "Renamed", ""),
  );
});

test("project archive preserves backend failures", async () => {
  await assertBackendFailure((client) =>
    createSupabaseProjectsRepository(client, neverCalled).setArchived("project-1", true),
  );
});

test("time-entry assignment preserves backend failures", async () => {
  await assertBackendFailure((client) =>
    createSupabaseTimeEntriesRepository(client, neverCalled).updateProject("entry-1", "project-1"),
  );
});
