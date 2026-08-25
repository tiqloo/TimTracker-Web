// Composition root — type-only entry point. The actual factory functions
// live in composition-root.client.ts (getBrowserRepositories) and
// composition-root.server.ts (getServerRepositories), split by Next.js
// runtime target on 2026-08-25 — see the comment at the top of
// composition-root.client.ts for the full reasoning (in short: this file
// used to statically import BOTH the browser and server Supabase clients,
// which broke `npm run build` once a Client Component ("use client")
// needed to reach it — importing this file at all pulled in
// lib/supabase/server.ts's next/headers dependency into the client
// bundle, which Next.js refuses to allow regardless of whether that
// branch is actually called).
//
// This file is kept (rather than deleted) purely so a type-only import
// of `Repositories` from "@/lib/composition-root" — the historical
// import path — keeps working. Prefer importing the `Repositories` type
// from lib/repositories/repositories.ts directly in new code.
export type { Repositories } from "@/lib/repositories/repositories";
