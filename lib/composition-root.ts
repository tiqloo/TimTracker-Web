import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseProjectsRepository } from "@/lib/repositories/supabase/projects.repository";
import { createSupabaseTimeEntriesRepository } from "@/lib/repositories/supabase/time-entries.repository";
import { createSupabaseSubscriptionRepository } from "@/lib/repositories/supabase/subscription.repository";
import { createSupabaseAuthRepository } from "@/lib/repositories/supabase/auth.repository";
import type { Repositories } from "@/lib/repositories/repositories";

export type { Repositories } from "@/lib/repositories/repositories";

// Composition root — analogous to App/DependencyContainer.swift in
// TimTracker-Starter. Wires the concrete Supabase adapters to the
// Repositories port aggregate. This is the ONLY file allowed to import
// lib/repositories/supabase/* — lib/application/* must import the
// Repositories TYPE from lib/repositories/repositories.ts instead
// (enforced by eslint.config.mjs).
//
// Moved out of lib/repositories/ on 2026-08-25 (structure review) —
// a composition root is not itself a repository/port, keeping it
// alongside them was semantically confusing.

// Use from Client Components ("use client").
export function getBrowserRepositories(): Repositories {
  const client = createBrowserSupabaseClient();
  return {
    projects: createSupabaseProjectsRepository(client),
    timeEntries: createSupabaseTimeEntriesRepository(client),
    subscription: createSupabaseSubscriptionRepository(client),
    auth: createSupabaseAuthRepository(client),
  };
}

// Use from Server Components / Route Handlers (async: cookies() is async).
export async function getServerRepositories(): Promise<Repositories> {
  const client = await createServerSupabaseClient();
  return {
    projects: createSupabaseProjectsRepository(client),
    timeEntries: createSupabaseTimeEntriesRepository(client),
    subscription: createSupabaseSubscriptionRepository(client),
    auth: createSupabaseAuthRepository(client),
  };
}
