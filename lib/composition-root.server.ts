import { cache } from "react";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseProjectsRepository } from "@/lib/repositories/supabase/projects.repository";
import { createSupabaseTimeEntriesRepository } from "@/lib/repositories/supabase/time-entries.repository";
import { createSupabaseSubscriptionRepository } from "@/lib/repositories/supabase/subscription.repository";
import { createSupabaseAuthRepository } from "@/lib/repositories/supabase/auth.repository";
import { createSupabaseWorkspaceRepository } from "@/lib/repositories/supabase/workspace.repository";
import { resolveWorkspaceIdWithFallback } from "@/lib/repositories/workspace.repository";
import { createCookieLanguageRepository } from "@/lib/repositories/cookie/language.server";
import { createCookieDailyGoalRepository } from "@/lib/repositories/cookie/daily-goal.server";
import { createCookieActiveWorkspaceRepository } from "@/lib/repositories/cookie/active-workspace.server";
import { UnauthorizedError } from "@/lib/domain/application-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repositories } from "@/lib/repositories/repositories";
import type { WorkspaceRepository } from "@/lib/repositories/workspace.repository";
import type { ActiveWorkspaceRepository } from "@/lib/repositories/active-workspace.repository";

// Ticket 103 — resolves which workspace projects.getAll()/create() and
// time-entries' range reads should operate on: the stored cookie value if
// the caller is still actually a member of it, otherwise their personal
// workspace (resolveWorkspaceIdWithFallback's own contract — see that
// function's doc). Wrapped in React's cache() for the same reason
// getRepositories() (lib/application/server.ts) wraps the whole
// Repositories construction: projects.getAll() AND timeEntries.getForRange()
// are commonly both called within the same server render (e.g. the "Heute"
// page), and without this they'd each independently re-run this lookup.
//
// Throws UnauthorizedError rather than falling back to some default when
// there's no signed-in user — every (dashboard)/* page that reaches this
// is already behind proxy.ts's auth gate, so an unauthenticated caller
// here means something is already badly wrong, not a normal edge case to
// paper over.
const resolveActiveWorkspaceIdForRequest = cache(
  async (client: SupabaseClient, workspace: WorkspaceRepository, activeWorkspace: ActiveWorkspaceRepository): Promise<string> => {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new UnauthorizedError();
    const cookieValue = await activeWorkspace.get();
    return resolveWorkspaceIdWithFallback(workspace, data.user.id, cookieValue);
  },
);

// Composition root — SERVER half. See composition-root.client.ts for the
// full reasoning behind the 2026-08-25 split; this file exists so
// lib/application/server.ts (Server Components / Route Handlers) can get
// a Repositories instance without ever statically pulling next/headers
// into a client bundle.
export async function getServerRepositories(): Promise<Repositories> {
  const client = await createServerSupabaseClient();
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
