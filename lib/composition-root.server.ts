import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseProjectsRepository } from "@/lib/repositories/supabase/projects.repository";
import { createSupabaseTimeEntriesRepository } from "@/lib/repositories/supabase/time-entries.repository";
import { createSupabaseSubscriptionRepository } from "@/lib/repositories/supabase/subscription.repository";
import { createSupabaseAuthRepository } from "@/lib/repositories/supabase/auth.repository";
import { createCookieLanguageRepository } from "@/lib/repositories/cookie/language.server";
import type { Repositories } from "@/lib/repositories/repositories";

// Composition root — SERVER half. See composition-root.client.ts for the
// full reasoning behind the 2026-08-25 split; this file exists so
// lib/application/server.ts (Server Components / Route Handlers) can get
// a Repositories instance without ever statically pulling next/headers
// into a client bundle.
export async function getServerRepositories(): Promise<Repositories> {
  const client = await createServerSupabaseClient();
  return {
    projects: createSupabaseProjectsRepository(client),
    timeEntries: createSupabaseTimeEntriesRepository(client),
    subscription: createSupabaseSubscriptionRepository(client),
    auth: createSupabaseAuthRepository(client),
    language: createCookieLanguageRepository(),
  };
}
