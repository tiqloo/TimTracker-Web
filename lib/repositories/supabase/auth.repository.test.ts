import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAuthRepository } from "./auth.repository.ts";

function oauthClient(result: { error: Error | null }) {
  const calls: unknown[] = [];
  const client = {
    auth: {
      async signInWithOAuth(input: unknown) {
        calls.push(input);
        return { data: { provider: "google", url: "https://accounts.google.test" }, ...result };
      },
      async exchangeCodeForSession() {
        return { data: { session: null, user: null }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function withOAuthEnvironment<T>(run: () => Promise<T>): Promise<T> {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SITE_URL = "https://tiqloo.example";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
  return run().finally(() => {
    if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  });
}

test("Google OAuth uses the PKCE callback and preserves the validated destination", async () => {
  const previousFetch = globalThis.fetch;
  const fake = oauthClient({ error: null });
  globalThis.fetch = async () => Response.json({ external: { google: true } });
  try {
    await withOAuthEnvironment(() =>
      createSupabaseAuthRepository(fake.client).signInWithGoogle("/dashboard/history?from=2026-09-01"),
    );
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.deepEqual(fake.calls, [{
    provider: "google",
    options: {
      redirectTo: "https://tiqloo.example/auth/callback?next=%2Fdashboard%2Fhistory%3Ffrom%3D2026-09-01",
    },
  }]);
});

test("disabled Google provider fails inside the app before navigating away", async () => {
  const previousFetch = globalThis.fetch;
  const fake = oauthClient({ error: null });
  globalThis.fetch = async () => Response.json({ external: { google: false } });
  try {
    await assert.rejects(
      withOAuthEnvironment(() =>
        createSupabaseAuthRepository(fake.client).signInWithGoogle("/dashboard"),
      ),
      /provider is not enabled/,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.deepEqual(fake.calls, []);
});

test("immediate Supabase OAuth errors are preserved", async () => {
  const previousFetch = globalThis.fetch;
  const backendError = new Error("oauth unavailable");
  const fake = oauthClient({ error: backendError });
  globalThis.fetch = async () => Response.json({ external: { google: true } });
  try {
    await assert.rejects(
      withOAuthEnvironment(() =>
        createSupabaseAuthRepository(fake.client).signInWithGoogle("/dashboard"),
      ),
      (error: unknown) => error === backendError,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
