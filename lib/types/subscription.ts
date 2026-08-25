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
