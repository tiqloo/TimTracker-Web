import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseProjectsRepository } from "./projects.repository.ts";
import { createSupabaseSubscriptionRepository } from "./subscription.repository.ts";
import { createSupabaseTimeEntriesRepository } from "./time-entries.repository.ts";

type QueryResult = { data: unknown; error: unknown };
type QueryCall = { method: string; args: unknown[] };

const PROJECT_COLUMNS =
  "id, name, color_hex, customer, notes, is_default, is_archived, updated_at";
const TIME_ENTRY_COLUMNS =
  "id, project_id, day, start_time, end_time, source, note, updated_at";

interface FakeClient {
  client: SupabaseClient;
  calls: QueryCall[];
}

function queryClient(result: QueryResult): FakeClient {
  const calls: QueryCall[] = [];
  const record = (method: string, ...args: unknown[]) => {
    calls.push({ method, args });
    return query;
  };
  const query = {
    select: (...args: unknown[]) => record("select", ...args),
    insert: (...args: unknown[]) => record("insert", ...args),
    update: (...args: unknown[]) => record("update", ...args),
    gte: (...args: unknown[]) => record("gte", ...args),
    lte: (...args: unknown[]) => record("lte", ...args),
    is: (...args: unknown[]) => record("is", ...args),
    eq: (...args: unknown[]) => record("eq", ...args),
    order: (...args: unknown[]) => record("order", ...args),
    range: async (...args: unknown[]) => {
      calls.push({ method: "range", args });
      return result;
    },
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

const projectRow = {
  id: "project-1",
  name: "Website",
  color_hex: "4C8FBF",
  customer: "Acme",
  notes: "Launch",
  is_default: false,
  is_archived: true,
  updated_at: "2026-08-31T10:20:30.000Z",
};

const timeEntryRow = {
  id: "entry-1",
  project_id: "project-1",
  day: "2026-08-31T00:00:00+00:00",
  start_time: "2026-08-31T08:00:00.000Z",
  end_time: "2026-08-31T09:30:00.000Z",
  source: "manual",
  note: "Planning",
  updated_at: "2026-08-31T09:30:00.000Z",
};

test("projects getAll selects explicit columns, orders deterministically and maps DTOs", async () => {
  const fake = queryClient({ data: [projectRow], error: null });

  const projects = await createSupabaseProjectsRepository(fake.client).getAll();

  assert.deepEqual(projects, [{
    id: "project-1",
    name: "Website",
    colorHex: "4C8FBF",
    customer: "Acme",
    notes: "Launch",
    isDefault: false,
    isArchived: true,
    updatedAt: "2026-08-31T10:20:30.000Z",
  }]);
  assert.deepEqual(methodCalls(fake.calls, "from"), [["projects"]]);
  assert.deepEqual(methodCalls(fake.calls, "select"), [[PROJECT_COLUMNS]]);
  assert.deepEqual(methodCalls(fake.calls, "order"), [
    ["updated_at", { ascending: false }],
    ["id", { ascending: true }],
  ]);
  assert.deepEqual(methodCalls(fake.calls, "range"), [[0, 999]]);
});

test("projects getAll maps a null PostgREST response to an empty list", async () => {
  const fake = queryClient({ data: null, error: null });
  assert.deepEqual(await createSupabaseProjectsRepository(fake.client).getAll(), []);
});

test("projects getAll preserves backend errors", async () => {
  const backendError = new Error("projects unavailable");
  const fake = queryClient({ data: null, error: backendError });
  await assert.rejects(
    createSupabaseProjectsRepository(fake.client).getAll(),
    (error: unknown) => error === backendError,
  );
});

test("project create sends defaults, explicitly selects and maps the mutation result", async () => {
  const fake = queryClient({ data: projectRow, error: null });

  const created = await createSupabaseProjectsRepository(fake.client).create({
    name: "Website",
    colorHex: "4C8FBF",
  });

  assert.equal(created.id, "project-1");
  assert.equal(created.colorHex, "4C8FBF");
  assert.deepEqual(methodCalls(fake.calls, "insert"), [[{
    name: "Website",
    color_hex: "4C8FBF",
    customer: "",
    notes: "",
  }]]);
  assert.deepEqual(methodCalls(fake.calls, "select"), [[PROJECT_COLUMNS]]);
  assert.equal(methodCalls(fake.calls, "maybeSingle").length, 1);
});

test("project rename maps the returned row and constrains the update by id", async () => {
  const fake = queryClient({ data: projectRow, error: null });

  const renamed = await createSupabaseProjectsRepository(fake.client).rename(
    "project-1",
    "Website",
    "Launch",
  );

  assert.equal(renamed.name, "Website");
  assert.deepEqual(methodCalls(fake.calls, "eq"), [["id", "project-1"]]);
  const [update] = methodCalls(fake.calls, "update")[0] as [{
    name: string;
    notes: string;
    updated_at: string;
  }];
  assert.equal(update.name, "Website");
  assert.equal(update.notes, "Launch");
  assert.equal(Number.isNaN(Date.parse(update.updated_at)), false);
  assert.deepEqual(methodCalls(fake.calls, "select"), [[PROJECT_COLUMNS]]);
});

test("project archive requires and accepts a returned mutation row", async () => {
  const fake = queryClient({ data: { id: "project-1" }, error: null });

  await createSupabaseProjectsRepository(fake.client).setArchived("project-1", true);

  assert.deepEqual(methodCalls(fake.calls, "eq"), [["id", "project-1"]]);
  const [update] = methodCalls(fake.calls, "update")[0] as [{
    is_archived: boolean;
    updated_at: string;
  }];
  assert.equal(update.is_archived, true);
  assert.equal(Number.isNaN(Date.parse(update.updated_at)), false);
  assert.deepEqual(methodCalls(fake.calls, "select"), [["id"]]);
});

test("time-entry range read selects, filters soft-deletes, orders and maps DTOs", async () => {
  const fake = queryClient({ data: [timeEntryRow], error: null });

  const entries = await createSupabaseTimeEntriesRepository(fake.client).getForRange(
    "2026-08-01",
    "2026-08-31",
    "project-1",
  );

  assert.deepEqual(entries, [{
    id: "entry-1",
    projectId: "project-1",
    day: "2026-08-31",
    startTime: "2026-08-31T08:00:00.000Z",
    endTime: "2026-08-31T09:30:00.000Z",
    source: "manual",
    note: "Planning",
    updatedAt: "2026-08-31T09:30:00.000Z",
  }]);
  assert.deepEqual(methodCalls(fake.calls, "from"), [["time_entries"]]);
  assert.deepEqual(methodCalls(fake.calls, "select"), [[TIME_ENTRY_COLUMNS]]);
  assert.deepEqual(methodCalls(fake.calls, "gte"), [["day", "2026-08-01"]]);
  assert.deepEqual(methodCalls(fake.calls, "lte"), [["day", "2026-08-31"]]);
  assert.deepEqual(methodCalls(fake.calls, "is"), [["deleted_at", null]]);
  assert.deepEqual(methodCalls(fake.calls, "eq"), [["project_id", "project-1"]]);
  assert.deepEqual(methodCalls(fake.calls, "order"), [
    ["start_time", { ascending: true }],
    ["id", { ascending: true }],
  ]);
  assert.deepEqual(methodCalls(fake.calls, "range"), [[0, 999]]);
});

test("time-entry day read has no project filter and accepts an empty response", async () => {
  const fake = queryClient({ data: null, error: null });

  const entries = await createSupabaseTimeEntriesRepository(fake.client).getForDay(
    "2026-08-31",
  );

  assert.deepEqual(entries, []);
  assert.deepEqual(methodCalls(fake.calls, "gte"), [["day", "2026-08-31"]]);
  assert.deepEqual(methodCalls(fake.calls, "lte"), [["day", "2026-08-31"]]);
  assert.deepEqual(methodCalls(fake.calls, "eq"), []);
});

test("time-entry range read preserves backend errors", async () => {
  const backendError = new Error("entries unavailable");
  const fake = queryClient({ data: null, error: backendError });
  await assert.rejects(
    createSupabaseTimeEntriesRepository(fake.client).getForRange("2026-08-01", "2026-08-31"),
    (error: unknown) => error === backendError,
  );
});

test("time-entry assignment sends and maps the mutation result", async () => {
  const fake = queryClient({ data: timeEntryRow, error: null });

  const updated = await createSupabaseTimeEntriesRepository(fake.client).updateProject(
    "entry-1",
    "project-1",
  );

  assert.equal(updated.id, "entry-1");
  assert.equal(updated.projectId, "project-1");
  assert.equal(updated.day, "2026-08-31");
  assert.deepEqual(methodCalls(fake.calls, "eq"), [["id", "entry-1"]]);
  const [update] = methodCalls(fake.calls, "update")[0] as [{
    project_id: string;
    updated_at: string;
  }];
  assert.equal(update.project_id, "project-1");
  assert.equal(Number.isNaN(Date.parse(update.updated_at)), false);
  assert.deepEqual(methodCalls(fake.calls, "select"), [[TIME_ENTRY_COLUMNS]]);
});

test("subscription read uses explicit columns and maps its DTO", async () => {
  const fake = queryClient({
    data: { status: "active", current_period_end: "2026-09-30T00:00:00.000Z" },
    error: null,
  });

  const subscription = await createSupabaseSubscriptionRepository(fake.client).getCurrent();

  assert.deepEqual(subscription, {
    status: "active",
    currentPeriodEnd: "2026-09-30T00:00:00.000Z",
  });
  assert.deepEqual(methodCalls(fake.calls, "from"), [["subscriptions"]]);
  assert.deepEqual(methodCalls(fake.calls, "select"), [["status, current_period_end"]]);
  assert.equal(methodCalls(fake.calls, "maybeSingle").length, 1);
});

test("subscription read maps no visible row to none and preserves backend errors", async () => {
  const empty = queryClient({ data: null, error: null });
  assert.deepEqual(
    await createSupabaseSubscriptionRepository(empty.client).getCurrent(),
    { status: "none", currentPeriodEnd: null },
  );

  const backendError = new Error("subscriptions unavailable");
  const failed = queryClient({ data: null, error: backendError });
  await assert.rejects(
    createSupabaseSubscriptionRepository(failed.client).getCurrent(),
    (error: unknown) => error === backendError,
  );
});
