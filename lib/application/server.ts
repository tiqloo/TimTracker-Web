// Composition-call wrapper for Server Components / Route Handlers — the
// Server-side counterpart to lib/application/client.ts. Same designated
// exception to the "lib/application/* never imports the composition
// root" rule (see eslint.config.mjs), same "zero business logic" rule.
//
// Usage from a Server Component page:
//
//   const repos = await getRepositories();
//   const today = await getTodayBreakdown(repos);
//
// Not used by the auth pages (Ticket 018 phase 1, all Client Components —
// they need onAuthStateChange/router-driven redirects, which require the
// browser client) but IS the pattern every app/(dashboard)/* page follows
// (Heute/Historie/Projekte/Einstellungen/Billing, all implemented as of
// Phase 1e — this comment used to describe them as still-TODO stubs,
// stale as of the Controller audit on 2026-08-31).
// Imports from composition-root.server.ts specifically — see
// lib/application/client.ts's comment and composition-root.client.ts's
// comment for why the single composition-root.ts barrel was split.
import { getServerRepositories } from "@/lib/composition-root.server";
import type { Repositories } from "@/lib/repositories/repositories";

export async function getRepositories(): Promise<Repositories> {
  return getServerRepositories();
}
