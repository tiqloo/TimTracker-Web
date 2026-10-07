// Application core (use cases) — mirrors AccessControlService.swift /
// SupabaseAccountService.openBillingPortal(). Driving adapters (pages)
// call these functions, never lib/repositories/* directly.
import { cache } from "react";
import type { Repositories } from "@/lib/repositories/repositories";
import type { Subscription } from "@/lib/domain/subscription";

// Ticket 072: wrapped in React's cache() — getSubscriptionStatus() is the
// most-duplicated call in the app: Heute/Historie/Historie-Tag/Projekte/
// Analytics (access gate), Settings (overview card) and Billing/
// Get-Started (own display) each call it independently, and
// repos.subscription.getCurrent() is a real Supabase query
// (`.from("subscriptions").select(...)`, see
// lib/repositories/supabase/subscription.repository.ts), not a local
// read. cache() collapses repeat calls within one request into one query;
// requires getRepositories() (server.ts) to also be cache()-wrapped so
// `repos` is the same instance across call sites.
export const getSubscriptionStatus = cache(async (
  repos: Repositories,
): Promise<Subscription> => {
  return repos.subscription.getCurrent();
});

export async function manageSubscription(repos: Repositories): Promise<string> {
  return repos.subscription.openBillingPortal();
}

export async function startSubscriptionCheckout(repos: Repositories): Promise<string> {
  return repos.subscription.startCheckout();
}
