// fetchRange()'s own comment claims the secondary `id` sort key "keeps
// offset pages deterministic and prevents gaps/duplicates at a boundary"
// when multiple rows share the same `start_time`. That claim rests on two
// pieces that were each tested separately but never together:
// - repository-contract.test.ts confirms the code REQUESTS both order()
//   calls with the right column/direction pairs.
// - pagination.test.ts confirms collectAllPages's offset/limit math is
//   correct in general (no duplicate-key scenario).
// Neither proves the actual, combined behavior this comment describes.
//
// Real Postgres guarantee this rests on: without a fully-deterministic
// ORDER BY (a unique tie-break column), row order among ties is
// UNSPECIFIED and the server is free to return them in a different
// relative order across separate query executions of the same statement.
// The fake client below models exactly that: it only sorts by whatever
// columns were actually passed to `.order()`, and — specifically to make a
// missing tie-break observable — reverses the relative order of any
// still-tied group on every other `range()` call, simulating that
// real cross-call nondeterminism. With the real `id` tie-break in place,
// no group is still tied after sorting, so this perturbation is a no-op
// and the result is fully deterministic; remove the tie-break and the
// perturbation actually flips a tied group's order between the two page
// fetches, producing a duplicate + a dropped row — exactly the failure
// this test exists to catch.
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseTimeEntriesRepository } from "./time-entries.repository.ts";
import { SUPABASE_PAGE_SIZE } from "./pagination.ts";

interface FakeRow {
  id: string;
  project_id: string;
  day: string;
  start_time: string;
  end_time: string | null;
  source: "automatic" | "manual";
  note: string | null;
  updated_at: string;
}

type OrderColumn = { column: string; ascending: boolean };

function paginatingClient(allRows: FakeRow[]): SupabaseClient {
  let rangeCallCount = 0;

  const makeQuery = () => {
    const orderColumns: OrderColumn[] = [];
    const query = {
      select: () => query,
      gte: () => query,
      lte: () => query,
      is: () => query,
      eq: () => query,
      order: (column: string, options?: { ascending?: boolean }) => {
        orderColumns.push({ column, ascending: options?.ascending ?? true });
        return query;
      },
      range: async (from: number, to: number) => {
        rangeCallCount += 1;
        const sorted = [...allRows].sort((a, b) => {
          for (const { column, ascending } of orderColumns) {
            const av = (a as unknown as Record<string, string>)[column];
            const bv = (b as unknown as Record<string, string>)[column];
            if (av !== bv) return ascending ? (av < bv ? -1 : 1) : av < bv ? 1 : -1;
          }
          return 0;
        });
        // Simulate real Postgres nondeterminism for whatever is STILL tied
        // after applying the requested order columns: without a unique
        // tie-break, group order among ties may differ between separate
        // query executions. Only every other call perturbs, so a
        // deterministic (fully tie-broken) order is unaffected either way,
        // while a non-deterministic one visibly disagrees between page 1
        // and page 2.
        if (rangeCallCount % 2 === 0) {
          for (let i = 0; i < sorted.length; ) {
            let j = i + 1;
            while (j < sorted.length && orderColumns.every(({ column }) => (sorted[j] as unknown as Record<string, string>)[column] === (sorted[i] as unknown as Record<string, string>)[column])) {
              j++;
            }
            if (j - i > 1) sorted.slice(i, j).reverse().forEach((row, k) => (sorted[i + k] = row));
            i = j;
          }
        }
        return { data: sorted.slice(from, to + 1), error: null };
      },
    };
    return query;
  };

  return { from: () => makeQuery() } as unknown as SupabaseClient;
}

function row(id: string, startTime: string): FakeRow {
  return {
    id,
    project_id: "project-1",
    day: "2026-08-31",
    start_time: startTime,
    end_time: null,
    source: "automatic",
    note: null,
    updated_at: startTime,
  };
}

test("getForRange reconstructs a complete, gap-free, duplicate-free list when duplicate start_time rows straddle a page boundary", async () => {
  // SUPABASE_PAGE_SIZE - 1 rows with a unique start_time each, then three
  // more sharing one identical start_time — placed so the tied group
  // straddles the page-1/page-2 boundary once sorted.
  const baseTime = Date.parse("2026-08-31T00:00:00.000Z");
  const uniqueRows = Array.from({ length: SUPABASE_PAGE_SIZE - 1 }, (_, i) =>
    row(`unique-${String(i).padStart(4, "0")}`, new Date(baseTime + i * 1000).toISOString()),
  );
  const tiedStartTime = "2026-08-31T23:59:59.000Z";
  const tiedRows = [
    row("z-tied-1", tiedStartTime),
    row("z-tied-2", tiedStartTime),
    row("z-tied-3", tiedStartTime),
  ];
  const allRows = [...uniqueRows, ...tiedRows];
  assert.equal(allRows.length, SUPABASE_PAGE_SIZE + 2, "test setup: exactly two rows must overflow into a second page");

  const client = paginatingClient(allRows);
  const entries = await createSupabaseTimeEntriesRepository(client, async () => "ws-1").getForRange("2026-08-01", "2026-08-31");

  assert.equal(entries.length, allRows.length, "every row must be returned exactly once — no gap, no duplicate at the page boundary");
  assert.deepEqual(new Set(entries.map((e) => e.id)).size, allRows.length, "no id may appear twice");
  assert.deepEqual(
    new Set(entries.map((e) => e.id)),
    new Set(allRows.map((r) => r.id)),
    "the reconstructed set of ids must exactly match the source rows",
  );
});
