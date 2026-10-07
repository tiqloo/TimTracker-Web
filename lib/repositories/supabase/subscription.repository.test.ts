import assert from "node:assert/strict";
import test from "node:test";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseSubscriptionRepository } from "./subscription.repository.ts";

function clientReturning(result: { data: unknown; error: unknown }, calls: string[]) {
  return {
    auth: {
      async getSession() {
        return { data: { session: { access_token: "user-jwt" } } };
      },
    },
    functions: {
      async invoke(name: string, options: { headers: Record<string, string> }) {
        calls.push(`${name}:${options.headers.Authorization}`);
        return result;
      },
    },
  } as unknown as SupabaseClient;
}

test("startCheckout(): calls create-checkout-session with the user's JWT and returns the url", async () => {
  const calls: string[] = [];
  const repo = createSupabaseSubscriptionRepository(
    clientReturning({ data: { url: "https://checkout.stripe.com/c/pay/x" }, error: null }, calls),
  );

  assert.equal(await repo.startCheckout(), "https://checkout.stripe.com/c/pay/x");
  assert.deepEqual(calls, ["create-checkout-session:Bearer user-jwt"]);
});

test("startCheckout(): surfaces the Edge Function's own error text", async () => {
  const repo = createSupabaseSubscriptionRepository(
    clientReturning(
      { data: null, error: new FunctionsHttpError(new Response("Preis nicht konfiguriert.", { status: 500 })) },
      [],
    ),
  );

  await assert.rejects(repo.startCheckout(), /Preis nicht konfiguriert\./);
});

test("startCheckout(): throws when the function returns no url", async () => {
  const repo = createSupabaseSubscriptionRepository(clientReturning({ data: {}, error: null }, []));

  await assert.rejects(repo.startCheckout(), /returned no url/);
});
