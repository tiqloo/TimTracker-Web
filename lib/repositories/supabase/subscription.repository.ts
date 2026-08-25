import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionRepository } from "../subscription.repository";
import type { Subscription, SubscriptionStatus } from "@/lib/domain/subscription";

interface SubscriptionRow {
  status: SubscriptionStatus;
  current_period_end: string | null;
}

export function createSupabaseSubscriptionRepository(
  client: SupabaseClient,
): SubscriptionRepository {
  return {
    async getCurrent() {
      const { data, error } = await client
        .from("subscriptions")
        .select("status, current_period_end")
        .maybeSingle();
      if (error) throw error;
      const row = (data as SubscriptionRow | null) ?? {
        status: "none" as SubscriptionStatus,
        current_period_end: null,
      };
      const result: Subscription = {
        status: row.status,
        currentPeriodEnd: row.current_period_end,
      };
      return result;
    },

    async openBillingPortal() {
      // Calls the SAME create-portal-session Edge Function already
      // deployed for Ticket 007 (supabase/functions/create-portal-session
      // in TimTracker-Starter) — no new backend endpoint for this.
      const { data, error } = await client.functions.invoke<{ url: string }>(
        "create-portal-session",
      );
      if (error) throw error;
      if (!data?.url) throw new Error("create-portal-session returned no url");
      return data.url;
    },
  };
}
