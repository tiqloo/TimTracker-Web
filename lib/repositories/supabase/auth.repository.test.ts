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

// getProfile()/updateDisplayName() themselves had no adapter-level test
// before this — added alongside Ticket 029's own avatar_path narrowing
// (getProfile's pre-existing "narrow user_metadata to string explicitly"
// rule now applies to both fields, worth locking in for the one this
// ticket actually touches).
function getUserClient(userMetadata: Record<string, unknown>) {
  const client = {
    auth: {
      async getUser() {
        return { data: { user: { email: "person@example.test", created_at: "2026-01-01T00:00:00Z", user_metadata: userMetadata } }, error: null };
      },
    },
  } as unknown as SupabaseClient;
  return client;
}

test("getProfile narrows a stored avatar_path string, same as display_name", async () => {
  const client = getUserClient({ display_name: "Ada", avatar_path: "user-1/avatar" });
  const profile = await createSupabaseAuthRepository(client).getProfile();
  assert.equal(profile.avatarPath, "user-1/avatar");
});

test("getProfile returns null avatarPath when avatar_path is absent or not a string", async () => {
  const withoutIt = await createSupabaseAuthRepository(getUserClient({})).getProfile();
  assert.equal(withoutIt.avatarPath, null);
  const withWrongType = await createSupabaseAuthRepository(getUserClient({ avatar_path: 123 })).getProfile();
  assert.equal(withWrongType.avatarPath, null);
});

// Ticket 029 — updateAvatar/removeAvatar/getAvatarUrl need `.auth.getUser()`
// (for the `{user_id}/avatar` path) plus `.storage`, not just `.auth`
// alone — own fake, same "own, smaller fake" precedent as signUpClient/
// sessionClient above (and storageClient in workspace.repository.test.ts,
// which this mirrors for the Storage half).
function avatarClient(options: {
  userId?: string;
  uploadResult?: { data: unknown; error: unknown };
  removeResult?: { data: unknown; error: unknown };
  signedUrlResult?: { data: unknown; error: unknown };
  updateUserResult?: { data: unknown; error: unknown };
}): { client: SupabaseClient; storageCalls: { method: string; args: unknown[] }[]; updateUserCalls: unknown[] } {
  const storageCalls: { method: string; args: unknown[] }[] = [];
  const updateUserCalls: unknown[] = [];
  const userId = options.userId ?? "user-1";
  const uploadResult = options.uploadResult ?? { data: { path: `${userId}/avatar` }, error: null };
  const removeResult = options.removeResult ?? { data: [], error: null };
  const signedUrlResult = options.signedUrlResult ?? { data: { signedUrl: `https://signed.example.test/${userId}/avatar` }, error: null };
  const updateUserResult = options.updateUserResult ?? { data: { user: {} }, error: null };
  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: userId } }, error: null };
      },
      async updateUser(...args: unknown[]) {
        updateUserCalls.push(...args);
        return updateUserResult;
      },
    },
    storage: {
      from: (bucket: string) => {
        storageCalls.push({ method: "from", args: [bucket] });
        return {
          upload: async (...args: unknown[]) => {
            storageCalls.push({ method: "upload", args });
            return uploadResult;
          },
          remove: async (...args: unknown[]) => {
            storageCalls.push({ method: "remove", args });
            return removeResult;
          },
          createSignedUrl: async (...args: unknown[]) => {
            storageCalls.push({ method: "createSignedUrl", args });
            return signedUrlResult;
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { client, storageCalls, updateUserCalls };
}

test("updateAvatar uploads to a fixed per-user path with upsert, then points user_metadata at it", async () => {
  const { client, storageCalls, updateUserCalls } = avatarClient({});
  const file = new File(["fake-bytes"], "avatar.png", { type: "image/png" });
  const path = await createSupabaseAuthRepository(client).updateAvatar(file);
  assert.equal(path, "user-1/avatar");
  assert.deepEqual(storageCalls[0], { method: "from", args: ["avatars"] });
  assert.equal(storageCalls[1].method, "upload");
  assert.deepEqual(storageCalls[1].args[0], "user-1/avatar");
  assert.deepEqual(storageCalls[1].args[2], { upsert: true, contentType: "image/png" });
  assert.deepEqual(updateUserCalls, [{ data: { avatar_path: "user-1/avatar" } }]);
});

test("updateAvatar propagates a Storage error without ever updating user_metadata", async () => {
  const { client, updateUserCalls } = avatarClient({ uploadResult: { data: null, error: new Error("The object exceeded the maximum allowed size") } });
  const file = new File(["fake-bytes"], "avatar.png", { type: "image/png" });
  await assert.rejects(createSupabaseAuthRepository(client).updateAvatar(file), /maximum allowed size/);
  assert.deepEqual(updateUserCalls, [], "user_metadata must never be updated if the upload itself failed");
});

test("updateAvatar propagates a user_metadata update error after a successful upload", async () => {
  const { client } = avatarClient({ updateUserResult: { data: null, error: new Error("Auth session missing") } });
  const file = new File(["fake-bytes"], "avatar.png", { type: "image/png" });
  await assert.rejects(createSupabaseAuthRepository(client).updateAvatar(file), /session missing/);
});

test("removeAvatar clears user_metadata BEFORE attempting the Storage delete", async () => {
  const { client, storageCalls, updateUserCalls } = avatarClient({});
  await createSupabaseAuthRepository(client).removeAvatar();
  assert.deepEqual(updateUserCalls, [{ data: { avatar_path: null } }]);
  const removeCall = storageCalls.find((call) => call.method === "remove");
  assert.deepEqual(removeCall?.args[0], ["user-1/avatar"]);
});

test("removeAvatar propagates a user_metadata update error without ever attempting the Storage delete", async () => {
  const { client, storageCalls } = avatarClient({ updateUserResult: { data: null, error: new Error("Auth session missing") } });
  await assert.rejects(createSupabaseAuthRepository(client).removeAvatar(), /session missing/);
  assert.ok(!storageCalls.some((call) => call.method === "remove"), "a failed pointer clear must never still attempt to delete the file");
});

test("getAvatarUrl requests a signed URL for the given path and returns it", async () => {
  const { client, storageCalls } = avatarClient({});
  const url = await createSupabaseAuthRepository(client).getAvatarUrl("user-1/avatar");
  assert.equal(url, "https://signed.example.test/user-1/avatar");
  const signedUrlCall = storageCalls.find((call) => call.method === "createSignedUrl");
  assert.deepEqual(signedUrlCall?.args, ["user-1/avatar", 300]);
});

test("getAvatarUrl propagates a Storage error (e.g. the object was already removed) instead of swallowing it", async () => {
  const { client } = avatarClient({ signedUrlResult: { data: null, error: new Error("Object not found") } });
  await assert.rejects(createSupabaseAuthRepository(client).getAvatarUrl("user-1/avatar"), /not found/);
});
