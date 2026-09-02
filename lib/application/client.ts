"use client";

// Composition-call wrapper for Client Components — the ONE designated
// exception to "lib/application/* never imports lib/composition-root.ts"
// (see the matching carve-out in eslint.config.mjs).
//
// Why this exists: app/* may only import lib/application/* (hexagonal
// boundary, enforced by ESLint). Every lib/application/* function takes a
// `Repositories` object as its first argument, but pages have no allowed
// way to construct one — lib/composition-root.ts (the only file that
// knows how to wire the Supabase adapters) is off-limits to them too.
// This file's only job is closing that gap: it is allowed to import the
// composition root (and ONLY the composition root — importing
// @supabase/supabase-js or lib/repositories/supabase/* here directly is
// still blocked, same as everywhere else in lib/application/*) and hands
// back a ready-to-use `Repositories` instance. It contains zero business
// logic on purpose — that stays in auth.ts/projects.ts/dashboard.ts/etc.
// Pages call `getRepositories()` here once, then pass the result into the
// actual use-case functions, e.g.:
//
//   const repos = getRepositories();
//   await login(repos, email, password);
//
// See lib/application/server.ts for the Server Component counterpart.
//
// Imports from composition-root.client.ts specifically (not the barrel
// "@/lib/composition-root") — see that file's comment: the barrel used to
// also statically import the server-side Supabase client, which broke
// `npm run build` the moment a "use client" module (this one) reached it,
// since Next.js refuses to bundle next/headers for the client at all.
import {
  getBrowserRepositories,
  subscribeToBrowserTimeEntryChanges,
} from "@/lib/composition-root.client";
import type { Repositories } from "@/lib/repositories/repositories";

export function getRepositories(): Repositories {
  return getBrowserRepositories();
}

export function subscribeToTimeEntryChanges(onChange: () => void): () => void {
  return subscribeToBrowserTimeEntryChanges(onChange);
}
