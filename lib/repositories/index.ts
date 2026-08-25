import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseProjectsRepository } from "./supabase/projects.repository";
import { createSupabaseTimeEntriesRepository } from "./supabase/time-entries.repository";
import { createSupabaseSubscriptionRepository } from "./supabase/subscription.repository";
import type { ProjectsRepository } from "./projects.repository";
import type { TimeEntriesRepository } from "./time-entries.repository";
import type { SubscriptionRepository } from "./subscription.repository";

export interface Repositories {
  projects: ProjectsRepository;
  timeEntries: TimeEntriesRepository;
  subscription: SubscriptionRepository;
}

// Composition root — analogous to App/DependencyContainer.swift in
// TimTracker-Starter. This is the ONLY file that should ever import
// lib/repositories/supabase/* directly. If a custom backend replaces
// Supabase for some or all of these domains later, only the two
// factory functions below change — every page/component keeps working
// unmodified, since they only ever depend on the Repositories interface.

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
