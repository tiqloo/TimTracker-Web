import type { SupabaseClient } from "@supabase/supabase-js";

// Real production bug found 2026-08-31 (docs/audit-findings.md in
// TimTracker-Starter): SupabaseClient.functions is a getter that builds a
// FunctionsClient with STATIC headers captured once at client construction
// (Authorization: Bearer <publishable key>) — unlike .auth/.from/etc., it
// never re-resolves the current session's access token. A plain
// `client.functions.invoke(name)` therefore ALWAYS sends the publishable
// key as the bearer token, never the signed-in user's JWT, regardless of
// login state. Every Edge Function gated with `withSupabase({auth:
// "user"})` (create-portal-session, delete-account) rejects that as "not
// a user credential" — a 401 that looks exactly like an auth/session bug
// but isn't one; the session itself was always fine.
//
// Fix: explicitly fetch the current session and pass its access_token as
// an Authorization header override on every call to a user-auth-gated
// function — the one documented, correct way to work around this
// supabase-js gap (confirmed against the actual @supabase/server@1.5.1
// source, which reads exactly `Authorization: Bearer <jwt>`).
export async function invokeAuthenticated<T = unknown>(
  client: SupabaseClient,
  functionName: string,
) {
  const {
    data: { session },
  } = await client.auth.getSession();
  return client.functions.invoke<T>(functionName, {
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });
}
