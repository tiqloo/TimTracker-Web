import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseProjectsRepository } from "./supabase/projects.repository";
import { createSupabaseTimeEntriesRepository } from "./supabase/time-entries.repository";
import { createSupabaseSubscriptionRepository } from "./supabase/subscription.repository";
import type { Repositories } from "./repositories";

export type { Repositories } from "./repositories";

// Composition root — analogous to App/DependencyContainer.swift in
// TimTracker-Starter. This is the ONLY file that should ever import
// lib/repositories/supabase/* directly. lib/application/* must import
// the Repositories type from ./repositories, NOT from here — this file
// is allowed to know about concrete adapters, the core is not.

// Use from Client Components ("use client").
export function getBrowserRepositories(): Repositories {
  const client = createBrowserSupabaseClient();
  return {
    projects: createSupabaseProjectsRepository(client),
    timeEntries: createSupabaseTimeEntriesRepository(client),
    subscription: createSupabaseSubscriptionRepository(client),
  };
}

// Use from Server Components / Route Handlers (async: cookies() is async).
export async function getServerRepositories(): Promise<Repositories> {
  const client = await createServerSupabaseClient();
  return {
    projects: createSupabaseProjectsRepository(client),
    timeEntries: createSupabaseTimeEntriesRepository(client),
    subscription: createSupabaseSubscriptionRepository(client),
  };
}
