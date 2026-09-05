// Ticket 099 — server-side workspace-membership checks. Same fake
// query-builder-chain convention as repository-contract.test.ts (own,
// smaller fake here since this port's query shape — select/eq/eq/limit/
// maybeSingle — differs from that file's range()-based ones).
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseWorkspaceRepository } from "./workspace.repository.ts";

type QueryResult = { data: unknown; error: unknown };
type QueryCall = { method: string; args: unknown[] };

function queryClient(result: QueryResult): { client: SupabaseClient; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const record = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
    return query;
  };
  const query = {
    select: (...args: unknown[]) => record("select", ...args),
    eq: (...args: unknown[]) => record("eq", ...args),
    limit: (...args: unknown[]) => record("limit", ...args),
    maybeSingle: async () => {
      calls.push({ method: "maybeSingle", args: [] });
      return result;
    },
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function methodCalls(calls: QueryCall[], method: string): unknown[][] {
  return calls.filter((call) => call.method === method).map((call) => call.args);
}

test("getMembership returns the membership row when one exists", async () => {
  const { client, calls } = queryClient({ data: { workspace_id: "ws-1", role: "admin" }, error: null });
  const membership = await createSupabaseWorkspaceRepository(client).getMembership("user-1", "ws-1");
  assert.deepEqual(membership, { workspaceId: "ws-1", role: "admin" });
  assert.deepEqual(methodCalls(calls, "from"), [["workspace_memberships"]]);
  assert.deepEqual(methodCalls(calls, "eq"), [["user_id", "user-1"], ["workspace_id", "ws-1"]]);
});

test("getMembership returns null (never throws) when no membership row exists — the same result for a foreign workspace and a nonexistent one", async () => {
  const { client } = queryClient({ data: null, error: null });
  const membership = await createSupabaseWorkspaceRepository(client).getMembership("user-1", "ws-not-mine");
  assert.equal(membership, null);
});

test("getMembership propagates a real query error instead of treating it as null", async () => {
  const { client } = queryClient({ data: null, error: new Error("connection reset") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).getMembership("user-1", "ws-1"), /connection reset/);
});

test("getPersonalWorkspaceId filters on workspace_type = PERSONAL and returns its id", async () => {
  const { client, calls } = queryClient({ data: { workspace_id: "ws-personal-1" }, error: null });
  const id = await createSupabaseWorkspaceRepository(client).getPersonalWorkspaceId("user-1");
  assert.equal(id, "ws-personal-1");
  assert.deepEqual(methodCalls(calls, "eq"), [["user_id", "user-1"], ["workspaces.workspace_type", "PERSONAL"]]);
  assert.deepEqual(methodCalls(calls, "limit"), [[1]]);
});

test("getPersonalWorkspaceId throws rather than silently returning an unusable value when Ticket 097's guarantee somehow doesn't hold", async () => {
  const { client } = queryClient({ data: null, error: null });
  await assert.rejects(createSupabaseWorkspaceRepository(client).getPersonalWorkspaceId("user-1"), /No personal workspace found/);
});

// Ticket 100 — createOrganization calls the create_organization_workspace
// RPC (a SECURITY DEFINER Postgres function, TimTracker-Starter repo),
// never a raw table insert.
function rpcClient(result: { data: unknown; error: unknown }): { client: SupabaseClient; calls: { fn: string; args: unknown }[] } {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("createOrganization calls create_organization_workspace with the given name and maps the returned row", async () => {
  const { client, calls } = rpcClient({
    data: [{ id: "ws-1", name: "PROMOS Consult", slug: "promos-consult", workspace_type: "ORGANIZATION" }],
    error: null,
  });
  const workspace = await createSupabaseWorkspaceRepository(client).createOrganization("PROMOS Consult");
  assert.deepEqual(workspace, { id: "ws-1", name: "PROMOS Consult", slug: "promos-consult", workspaceType: "ORGANIZATION" });
  assert.deepEqual(calls, [{ fn: "create_organization_workspace", args: { workspace_name: "PROMOS Consult" } }]);
});

test("createOrganization propagates an RPC error (e.g. the server-side name validation failing) instead of swallowing it", async () => {
  const { client } = rpcClient({ data: null, error: new Error("Workspace name must not be empty") });
  await assert.rejects(createSupabaseWorkspaceRepository(client).createOrganization(""), /must not be empty/);
});

test("createOrganization throws rather than returning an unusable value if the RPC unexpectedly returns no row", async () => {
  const { client } = rpcClient({ data: [], error: null });
  await assert.rejects(createSupabaseWorkspaceRepository(client).createOrganization("x"), /no row/);
});
