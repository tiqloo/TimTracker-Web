// Application core (use cases) — mirrors AccessControlService.swift /
// SupabaseAccountService.openBillingPortal(). Driving adapters (pages)
// call these functions, never lib/repositories/* directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { Subscription } from "@/lib/types/subscription";

export async function getSubscriptionStatus(
  repos: Repositories,
): Promise<Subscription> {
  return repos.subscription.getCurrent();
}

export async function manageSubscription(repos: Repositories): Promise<string> {
  return repos.subscription.openBillingPortal();
}
