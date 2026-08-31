import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";

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
  // getSession() reads from local storage/cookies without a network round
  // trip, so it can briefly return null on a freshly loaded page even
  // though the user genuinely has a valid session (the browser client's
  // async session restore hasn't resolved yet). A null session here
  // previously fell through to functions.invoke() with no override header,
  // silently reproducing the exact publishable-key bug this file exists to
  // fix — throw a clear, actionable error instead of a confusing "Nicht
  // angemeldet." from the server side.
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    throw new Error(
      "Sitzung konnte nicht geladen werden. Bitte die Seite neu laden und erneut versuchen.",
    );
  }
  return client.functions.invoke<T>(functionName, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}

// `functions.invoke()`'s returned `error` for a non-2xx response is a
// FunctionsHttpError whose OWN .message is always the same generic string
// ("Edge Function returned a non-2xx status code") — the function's real
// response body (e.g. "Kein Stripe-Kunde hinterlegt...", the exact text
// this repo's own Edge Functions return) lives separately in
// `error.context`, a Response object that has to be read explicitly
// (documented in @supabase/functions-js's own FunctionsClient.ts). Without
// this, every distinct server-side error (missing customer, expired
// access, a genuine 500) looks identical and unhelpful in the UI — surface
// it instead.
export async function describeFunctionsError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    const body = await error.context.text().catch(() => "");
    if (body) return new Error(body);
  }
  return error instanceof Error ? error : new Error(String(error));
}
