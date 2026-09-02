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
import { cache } from "react";
import { getServerRepositories } from "@/lib/composition-root.server";
import type { Repositories } from "@/lib/repositories/repositories";

// Ticket 072: wrapped in React's cache() so every call within the SAME
// server request (app/(dashboard)/layout.tsx's own call plus whatever the
// active page.tsx calls independently right after it — every
// (dashboard)/* page follows that same "fetch here, gate here" pattern,
// see CLAUDE.md) returns the exact same Repositories instance instead of
// constructing a brand-new Supabase client per call site. On its own this
// doesn't save a network round trip (creating a client is local), but it
// is the precondition for getEffectiveLanguageCode()/getProfile()/
// getSubscriptionStatus() below to dedupe THEIR underlying Supabase
// queries via cache() too — those only recognize two calls as "the same
// call" when the `repos` argument is reference-equal, which requires this
// wrapper. cache()'s dedupe window is exactly one request/render pass
// (Next.js resets it per request), so this can't leak stale data across
// requests/users.
export const getRepositories = cache(async (): Promise<Repositories> => {
  return getServerRepositories();
});
