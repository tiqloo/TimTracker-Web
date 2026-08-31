import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionRepository } from "../subscription.repository";
import type { Subscription, SubscriptionStatus } from "@/lib/domain/subscription";
import { invokeAuthenticated } from "./invoke-authenticated";

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
      //
      // invokeAuthenticated(), not client.functions.invoke() directly —
      // see that helper's own comment: SupabaseClient.functions sends a
      // static publishable-key bearer token by default, never the
      // signed-in user's JWT, which this auth:"user"-gated function
      // rejects with a 401 that looks like an auth bug but isn't one
      // (real production incident, 2026-08-31, see
      // docs/audit-findings.md in TimTracker-Starter).
      const { data, error } = await invokeAuthenticated<{ url: string }>(
        client,
        "create-portal-session",
      );
      if (error) throw error;
      if (!data?.url) throw new Error("create-portal-session returned no url");
      return data.url;
    },
  };
}
