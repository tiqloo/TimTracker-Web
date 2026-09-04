import assert from "node:assert/strict";
import test from "node:test";
import { AuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAuthRepository } from "./auth.repository.ts";
import { EmailAlreadyRegisteredError } from "../auth.repository.ts";

function signUpClient(result: { data: unknown; error: Error | null }) {
  const client = {
    auth: {
      async signUp() {
        return result;
      },
    },
  } as unknown as SupabaseClient;
  return client;
}

// Ticket 074's register() detects an already-registered email two
// different ways depending on the project's mailer_autoconfirm setting —
// see the function's own comments for the full explanation of both
// branches. Neither branch had a test before this: the "user_already_exists"
// error-code path (local/dev autoconfirm-on config) and the "empty
// identities array" success-shape path (production autoconfirm-off
// config, Supabase's documented anti-enumeration behavior) are both
// exercised below, plus the genuine-new-signup case that must NOT throw.

test("register(): a Supabase user_already_exists error code is translated to EmailAlreadyRegisteredError", async () => {
  const client = signUpClient({
    data: { user: null, session: null },
    error: new AuthApiError("User already registered", 422, "user_already_exists"),
  });

  await assert.rejects(
    createSupabaseAuthRepository(client).register("taken@example.com", "password123"),
    EmailAlreadyRegisteredError,
  );
});

test("register(): an already-registered email returning the anti-enumeration success shape (empty identities) is also translated to EmailAlreadyRegisteredError", async () => {
  const client = signUpClient({
    data: { user: { identities: [] }, session: null },
    error: null,
  });

  await assert.rejects(
    createSupabaseAuthRepository(client).register("taken@example.com", "password123"),
    EmailAlreadyRegisteredError,
  );
});

test("register(): a genuine new signup (non-empty identities) does not throw", async () => {
  const client = signUpClient({
    data: { user: { identities: [{ id: "provider-identity" }] }, session: null },
    error: null,
  });

  const result = await createSupabaseAuthRepository(client).register("new@example.com", "password123");

  assert.deepEqual(result, { emailConfirmationRequired: true });
});

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

// The "not enabled" preflight check's own comment claims it "fails open"
// (falls through to the normal signInWithOAuth() call) for anything other
// than a confirmed "google: false" response — a network hiccup, a non-ok
// response, or unexpected JSON must never themselves block sign-in. Only
// the happy paths (fetch resolving with google:true/false) were tested
// before this — none of the three failure shapes the try/catch is meant to
// swallow were. All three below assert the OAuth call still goes through.

test("Google OAuth preflight check failing open: fetch throws", async () => {
  const previousFetch = globalThis.fetch;
  const fake = oauthClient({ error: null });
  globalThis.fetch = async () => {
    throw new TypeError("network error");
  };
  try {
    await withOAuthEnvironment(() =>
      createSupabaseAuthRepository(fake.client).signInWithGoogle("/dashboard"),
    );
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(fake.calls.length, 1, "a failed preflight request must not block the real OAuth call");
});

test("Google OAuth preflight check failing open: settings endpoint returns non-ok", async () => {
  const previousFetch = globalThis.fetch;
  const fake = oauthClient({ error: null });
  globalThis.fetch = async () => new Response("service unavailable", { status: 503 });
  try {
    await withOAuthEnvironment(() =>
      createSupabaseAuthRepository(fake.client).signInWithGoogle("/dashboard"),
    );
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(fake.calls.length, 1, "a non-ok preflight response must not block the real OAuth call");
});

test("Google OAuth preflight check failing open: settings endpoint returns malformed JSON", async () => {
  const previousFetch = globalThis.fetch;
  const fake = oauthClient({ error: null });
  globalThis.fetch = async () => new Response("not json", { status: 200 });
  try {
    await withOAuthEnvironment(() =>
      createSupabaseAuthRepository(fake.client).signInWithGoogle("/dashboard"),
    );
  } finally {
    globalThis.fetch = previousFetch;
  }

  assert.equal(fake.calls.length, 1, "malformed preflight JSON must not block the real OAuth call");
});

function sessionClient(session: { access_token: string; refresh_token: string } | null) {
  const client = {
    auth: {
      async getSession() {
        return { data: { session }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  return client;
}

test("getDesktopHandoffTokens returns the current session's tokens", async () => {
  const client = sessionClient({ access_token: "abc", refresh_token: "def" });

  const result = await createSupabaseAuthRepository(client).getDesktopHandoffTokens();

  assert.deepEqual(result, { accessToken: "abc", refreshToken: "def" });
});

test("getDesktopHandoffTokens returns null without a session", async () => {
  const client = sessionClient(null);

  const result = await createSupabaseAuthRepository(client).getDesktopHandoffTokens();

  assert.equal(result, null);
});
