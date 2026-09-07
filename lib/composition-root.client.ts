import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createSupabaseProjectsRepository } from "@/lib/repositories/supabase/projects.repository";
import { createSupabaseTimeEntriesRepository } from "@/lib/repositories/supabase/time-entries.repository";
import { createSupabaseSubscriptionRepository } from "@/lib/repositories/supabase/subscription.repository";
import { createSupabaseAuthRepository } from "@/lib/repositories/supabase/auth.repository";
import { createSupabaseWorkspaceRepository } from "@/lib/repositories/supabase/workspace.repository";
import { resolveWorkspaceIdWithFallback } from "@/lib/repositories/workspace.repository";
import { createCookieLanguageRepository } from "@/lib/repositories/cookie/language.client";
import { createCookieDailyGoalRepository } from "@/lib/repositories/cookie/daily-goal.client";
import { createCookieActiveWorkspaceRepository } from "@/lib/repositories/cookie/active-workspace.client";
import { UnauthorizedError } from "@/lib/domain/application-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repositories } from "@/lib/repositories/repositories";

// Composition root — BROWSER half. Analogous to
// App/DependencyContainer.swift in TimTracker-Starter, wires the concrete
// Supabase adapters to the Repositories port aggregate. This is one of
// only two files allowed to import lib/repositories/supabase/* (the
// other being composition-root.server.ts) — lib/application/* must
// import the Repositories TYPE from lib/repositories/repositories.ts
// instead (enforced by eslint.config.mjs).
//
// Split from a single lib/composition-root.ts on 2026-08-25 while wiring
// up Ticket 018's auth pages: lib/application/client.ts (a "use client"
// module, itself the designated exception letting Client Components
// reach a composition root — see its own comment) imports
// getBrowserRepositories() below. The original single-file composition
// root ALSO statically imported lib/supabase/server.ts (which imports
// next/headers, a Server-Components-only API) for its
// getServerRepositories() half. Next.js's bundler refuses to include ANY
// module that reaches next/headers in a client bundle, even when the
// server-only branch is never actually called from client code — the
// static import alone is enough to break `npm run build` ("You're
// importing a module that depends on next/headers ... in the Pages
// Router" — a real error hit and fixed during this ticket, not a
// hypothetical). Splitting the composition root by target runtime is the
// standard fix for this class of problem; lib/composition-root.ts itself
// is kept as a thin type-only re-export so existing type imports of
// `Repositories` from it keep working.
// Ticket 103 — same resolution rule as composition-root.server.ts's own
// resolveActiveWorkspaceIdForRequest, but NOT cache()-wrapped: React's
// cache() is a Server Components/RSC-render primitive, unavailable here
// (getBrowserRepositories() itself stays synchronous — see this file's own
// comment above — precisely because it's called fresh on every render by
// many Client Components, so there's no single "one request" scope to
// dedupe within anyway). The extra query this costs per getAll()/
// getForRange() call is the accepted tradeoff for keeping this factory
// synchronous; see projects.repository.ts's own comment for the full
// reasoning.
async function resolveActiveWorkspaceIdForRequest(
  client: SupabaseClient,
  workspace: ReturnType<typeof createSupabaseWorkspaceRepository>,
  activeWorkspace: ReturnType<typeof createCookieActiveWorkspaceRepository>,
): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new UnauthorizedError();
  const cookieValue = await activeWorkspace.get();
  return resolveWorkspaceIdWithFallback(workspace, data.user.id, cookieValue);
}

export function getBrowserRepositories(): Repositories {
  const client = createBrowserSupabaseClient();
  const workspace = createSupabaseWorkspaceRepository(client);
  const activeWorkspace = createCookieActiveWorkspaceRepository();
  const getActiveWorkspaceId = () => resolveActiveWorkspaceIdForRequest(client, workspace, activeWorkspace);
  return {
    projects: createSupabaseProjectsRepository(client, getActiveWorkspaceId),
    timeEntries: createSupabaseTimeEntriesRepository(client, getActiveWorkspaceId),
    subscription: createSupabaseSubscriptionRepository(client),
    auth: createSupabaseAuthRepository(client),
    language: createCookieLanguageRepository(),
    dailyGoal: createCookieDailyGoalRepository(),
    workspace,
    activeWorkspace,
  };
}

export function subscribeToBrowserTimeEntryChanges(onChange: () => void): () => void {
  const client = createBrowserSupabaseClient();
  const channel = client
    .channel("today-time-entry-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "time_entries" },
      onChange,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
