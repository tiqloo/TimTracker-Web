// Domain model — mirrors Domain/Models/SubscriptionStatus.swift in
// TimTracker-Starter and the `subscriptions` table shape.
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete_expired"
  | "none";

export interface Subscription {
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

// Real business rule, not just a data shape — kept here so it lives in
// exactly one place instead of being reimplemented in a page/component.
// Deliberately mirrors the RLS policy condition verbatim (see
// supabase/migrations/0001_init.sql + 0003_trial.sql in TimTracker-Starter):
//   status in ('active', 'trialing') and
//   (current_period_end is null or current_period_end > now())
// If this ever drifts from the SQL, the web UI and the database would
// disagree about who has access — keep both in sync deliberately.
export function canUseApp(subscription: Subscription, now: Date = new Date()): boolean {
  const hasEntitlingStatus =
    subscription.status === "active" || subscription.status === "trialing";
  const notExpired =
    subscription.currentPeriodEnd === null ||
    new Date(subscription.currentPeriodEnd) > now;
  return hasEntitlingStatus && notExpired;
}

// Mirrors the native app (SettingsViewModel.showsManageSubscriptionCTA):
// only a paying subscription is guaranteed to have a Stripe customer, so
// only then can the billing portal be opened. Everyone else (trial, none,
// expired, ...) has no stripe_customer_id yet and must start checkout —
// create-portal-session would answer 409 "Kein Stripe-Kunde hinterlegt".
export function canManageInBillingPortal(subscription: Subscription): boolean {
  return subscription.status === "active";
}
