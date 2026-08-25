// TODO (Ticket 018): "Heute" — via
//   const repos = await getRepositories(); // from "@/lib/application/server"
//   const today = await getTodayBreakdown(repos);
// Pages call lib/application/* (the core), never lib/repositories/* or
// lib/composition-root* directly — that's the hexagonal boundary: UI is
// a driving adapter, repositories are driven ports/adapters,
// application/ is the core between them. lib/application/server.ts is
// the designated exception that hands Server Components a Repositories
// instance without reaching the composition root themselves — see its
// comment, CLAUDE.md's "Resolved 2026-08-25" entry, and the auth pages
// (app/(auth)/*) for the same pattern already in use client-side via
// lib/application/client.ts.
export default function TodayPage() {
  return <main className="p-8">Heute — TODO</main>;
}
