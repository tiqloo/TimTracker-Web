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

  const result = await client.functions.invoke<T>(functionName, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!isUnauthenticatedFunctionError(result.error)) {
    return result;
  }

  // Real production bug (reported via screenshot: "Abo verwalten" showing
  // "Nicht angemeldet." although genuinely signed in). Root cause is in
  // auth-js's own GoTrueClient.__loadSession(): when the stored access
  // token is past its eager-refresh margin, it tries to refresh, and if
  // that refresh fails non-retryably (e.g. a concurrent tab/request
  // already rotated the one-time-use refresh token) it falls back to
  // handing back the STALE stored access token instead of null, as long as
  // that token's own expires_at hasn't been reached yet client-side. That
  // stale token still gets accepted by getSession() above, but is rejected
  // by the Edge Function's JWT verification server-side — surfacing the
  // server's generic "not signed in" response even though the user is.
  // client.auth.refreshSession() (unlike getSession()) always talks to the
  // auth server directly and bypasses that stale-storage fallback, so
  // retry exactly once with a force-refreshed token. A second 401 after an
  // explicit refresh means the session is genuinely dead, not stale.
  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  if (refreshError || !refreshed.session) {
    return result;
  }
  return client.functions.invoke<T>(functionName, {
    headers: { Authorization: `Bearer ${refreshed.session.access_token}` },
  });
}

function isUnauthenticatedFunctionError(error: unknown): boolean {
  return (
    error instanceof FunctionsHttpError &&
    error.context instanceof Response &&
    error.context.status === 401
  );
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
