import type { Subscription } from "@/lib/domain/subscription";

// Swap point for a future backend — see projects.repository.ts for the
// rationale. `openBillingPortal` calls the SAME create-portal-session
// Edge Function already deployed for Ticket 007 in TimTracker-Starter —
// no new backend endpoint needed for this one, only this client call.
export interface SubscriptionRepository {
  getCurrent(): Promise<Subscription>;
  openBillingPortal(): Promise<string>; // returns the portal URL to redirect to
  startCheckout(): Promise<string>; // returns the Stripe Checkout URL to redirect to
}
