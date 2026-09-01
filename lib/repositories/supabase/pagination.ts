// Supabase/PostgREST returns at most 1,000 rows by default. Keep the page
// collector independent from Supabase's query-builder types so its stop/error
// behavior can be tested without a network client.
export const SUPABASE_PAGE_SIZE = 1_000;

export async function collectAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new RangeError("pageSize must be a positive safe integer");
  }

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
