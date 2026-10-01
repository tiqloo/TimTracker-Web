import assert from "node:assert/strict";
import test from "node:test";
import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { invokeAuthenticated } from "./invoke-authenticated.ts";

function session(accessToken: string) {
  return { access_token: accessToken } as never;
}

function unauthenticatedError() {
  return new FunctionsHttpError(
    new Response("Nicht angemeldet.", { status: 401 }),
  );
}

// GitHub tiqloo/TimTracker-Web#20: a stale-but-not-yet-client-expired
// access token (auth-js's own __loadSession() fallback after a failed
// background refresh) is accepted by getSession() but rejected by the
// Edge Function's JWT check — invokeAuthenticated() must recover by
// forcing a real refreshSession() and retrying exactly once.

test("invokeAuthenticated(): a successful first call does not trigger a refresh", async () => {
  let refreshCalls = 0;
  const client = {
    auth: {
      async getSession() {
        return { data: { session: session("token-1") } };
      },
      async refreshSession() {
        refreshCalls++;
        throw new Error("should not be called");
      },
    },
    functions: {
      async invoke() {
        return { data: { url: "https://billing.stripe.com/session" }, error: null };
      },
    },
  } as unknown as SupabaseClient;

  const result = await invokeAuthenticated(client, "create-portal-session");

  assert.equal(refreshCalls, 0);
  assert.deepEqual(result.data, { url: "https://billing.stripe.com/session" });
});

test("invokeAuthenticated(): a 401 triggers one refresh and retry, which then succeeds", async () => {
  let invokeCalls = 0;
  let refreshCalls = 0;
  const client = {
    auth: {
      async getSession() {
        return { data: { session: session("stale-token") } };
      },
      async refreshSession() {
        refreshCalls++;
        return { data: { session: session("fresh-token") }, error: null };
      },
    },
    functions: {
      async invoke(_name: string, options: { headers: Record<string, string> }) {
        invokeCalls++;
        if (options.headers.Authorization === "Bearer stale-token") {
          return { data: null, error: unauthenticatedError() };
        }
        assert.equal(options.headers.Authorization, "Bearer fresh-token");
        return { data: { url: "https://billing.stripe.com/session" }, error: null };
      },
    },
  } as unknown as SupabaseClient;

  const result = await invokeAuthenticated(client, "create-portal-session");

  assert.equal(refreshCalls, 1);
  assert.equal(invokeCalls, 2);
  assert.deepEqual(result.data, { url: "https://billing.stripe.com/session" });
});

test("invokeAuthenticated(): a 401 whose refresh also fails surfaces the original 401 unchanged", async () => {
  let invokeCalls = 0;
  const client = {
    auth: {
      async getSession() {
        return { data: { session: session("stale-token") } };
      },
      async refreshSession() {
        return { data: { session: null }, error: new Error("refresh token already used") };
      },
    },
    functions: {
      async invoke() {
        invokeCalls++;
        return { data: null, error: unauthenticatedError() };
      },
    },
  } as unknown as SupabaseClient;

  const result = await invokeAuthenticated(client, "create-portal-session");

  assert.equal(invokeCalls, 1);
  assert.ok(result.error instanceof FunctionsHttpError);
});

test("invokeAuthenticated(): a non-401 error does not trigger a refresh or retry", async () => {
  let invokeCalls = 0;
  let refreshCalls = 0;
  const client = {
    auth: {
      async getSession() {
        return { data: { session: session("token-1") } };
      },
      async refreshSession() {
        refreshCalls++;
        throw new Error("should not be called");
      },
    },
    functions: {
      async invoke() {
        invokeCalls++;
        return {
          data: null,
          error: new FunctionsHttpError(
            new Response("Kein Stripe-Kunde hinterlegt. Bitte zuerst ein Abo abschließen.", {
              status: 409,
            }),
          ),
        };
      },
    },
  } as unknown as SupabaseClient;

  const result = await invokeAuthenticated(client, "create-portal-session");

  assert.equal(invokeCalls, 1);
  assert.equal(refreshCalls, 0);
  assert.ok(result.error instanceof FunctionsHttpError);
});
