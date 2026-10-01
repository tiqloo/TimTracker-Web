import type { SubscriptionStatus } from "@/lib/domain/subscription";

export type BillingStatusTone = "success" | "warning" | "neutral";
export type BillingPeriodLabel = "trialEndsOn" | "nextRenewalOn" | "accessEndedOn";

export interface BillingStatusPresentation {
  tone: BillingStatusTone;
  periodLabel: BillingPeriodLabel;
}

/**
 * Keeps the visual treatment of every backend status explicit. New Stripe
 * states cannot silently inherit an inappropriate success treatment.
 */
export function getBillingStatusPresentation(
  status: SubscriptionStatus,
): BillingStatusPresentation {
  switch (status) {
    case "active":
      return { tone: "success", periodLabel: "nextRenewalOn" };
    case "trialing":
      return { tone: "success", periodLabel: "trialEndsOn" };
    case "past_due":
    case "unpaid":
      return { tone: "warning", periodLabel: "accessEndedOn" };
    case "canceled":
    case "incomplete_expired":
    case "none":
      return { tone: "neutral", periodLabel: "accessEndedOn" };
  }
}
