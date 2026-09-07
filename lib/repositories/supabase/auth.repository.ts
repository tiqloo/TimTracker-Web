import { AuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import {
  EmailAlreadyInUseError,
  EmailAlreadyRegisteredError,
  ReauthenticationFailedError,
  type AuthChangeEvent,
  type AuthRepository,
} from "../auth.repository.ts";
import type { Profile } from "../../domain/profile.ts";
import { describeFunctionsError, invokeAuthenticated } from "./invoke-authenticated.ts";

export function createSupabaseAuthRepository(
  client: SupabaseClient,
): AuthRepository {
  return {
    async getAuthenticatedUserId() {
      // getUser(), not getSession(): authorization is based on an identity
      // revalidated by Supabase Auth, never on editable JWT metadata.
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return data.user.id;
    },

    async register(email: string, password: string, redirectTo?: string) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          // Real-backend testing (2026-08-25) confirmed the production
          // project requires email confirmation (mailer_autoconfirm:
          // false) — Supabase's default confirmation-link redirect target
          // is NEXT_PUBLIC_SITE_URL itself, which is a PROTECTED
          // dashboard route here (see proxy.ts). Point it at /login
          // instead: it's always publicly reachable, and login/page.tsx
          // instantiates the browser client on mount specifically to
          // finish processing a confirmation link's session tokens (see
          // the comment there) and then bounces the user into the app.
          // Ticket 102: `redirectTo` (already validated by the caller —
          // see AuthRepository#register's own doc) carries a pending
          // workspace-invitation link through the confirmation-email
          // round trip, so accepting it doesn't get lost behind "confirm
          // your email first".
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login?redirectTo=${encodeURIComponent(redirectTo ?? "/dashboard/get-started")}`,
        },
      });
      if (error) {
        // Ticket 074. Verified LIVE against the local Docker stack
        // (2026-09-02): with `mailer_autoconfirm: true` (local dev only —
        // production has it false, confirmed 2026-08-25), signUp() with an
        // already-registered email throws directly with this error_code
        // (AuthApiError.code === "user_already_exists"), rather than the
        // silent "empty identities" success path handled below for the
        // confirmation-required case. Both branches are handled so
        // detection works regardless of the project's mailer_autoconfirm
        // setting.
        const isAlreadyRegistered =
          error instanceof AuthApiError && error.code === "user_already_exists";
        throw isAlreadyRegistered ? new EmailAlreadyRegisteredError() : error;
      }
      // Ticket 074. Supabase's documented anti-enumeration behavior for
      // projects that require email confirmation (production:
      // `mailer_autoconfirm: false`, confirmed 2026-08-25): signUp() with
      // an ALREADY-registered email does NOT throw here — it returns the
      // same 200 success shape as a genuine new signup, distinguishable
      // only by `data.user.identities` being an empty array (a real new
      // signup always has exactly one populated entry, confirmed via the
      // "identities" shape returned by the local stack's own signUp
      // response). NOT independently re-verified against a live
      // mailer_autoconfirm:false backend in this environment — the local
      // stack used for the above verification has autoconfirm ON, so it
      // takes the branch above instead; this specific branch still needs
      // human confirmation against production before shipping (see
      // Ticket 074's final report).
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new EmailAlreadyRegisteredError();
      }
      // data.session is null when Supabase is waiting on email
      // confirmation, populated when signup logs the user in immediately
      // (local/dev config, or a project with confirmations disabled).
      return { emailConfirmationRequired: data.session === null };
    },

    async login(email: string, password: string) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },

    async signInWithGoogle(destinationPath: string) {
      // Real-backend finding (2026-09-02, local Docker stack, Ticket
      // 077): client.auth.signInWithOAuth() does NOT reject when the
      // provider is disabled. Reading @supabase/auth-js's own source
      // (_handleProviderSignIn/_getUrlForProvider in GoTrueClient.js)
      // confirms it builds the `/auth/v1/authorize` URL purely
      // client-side — no preflight request — and, in a browser,
      // unconditionally calls `window.location.assign(url)`, always
      // resolving with `error: null`. GoTrue only rejects once the
      // browser actually lands on that URL, and for a disabled provider
      // it does so with a raw 400 JSON body (verified via curl against
      // this project's own local stack: `GET .../auth/v1/authorize
      // ?provider=google` -> `400 {"error_code":"validation_failed",
      // "msg":"Unsupported provider: provider is not enabled"}`, no
      // Location header) — NOT a redirect back to redirectTo with
      // `?error=...` the way a genuine mid-flow failure (e.g. the user
      // cancelling Google's consent screen, handled on the login page
      // separately) does. Left as just a plain signInWithOAuth() call,
      // this is exactly the "undurchsichtiger Fehler" (opaque error) the
      // ticket's own AK says must not happen: the browser would navigate
      // away to a bare JSON page instead of showing this app's error UI.
      //
      // Fix: check the project's actual enabled-providers list FIRST —
      // the same public, unauthenticated `/auth/v1/settings` endpoint the
      // ticket's own "Ausgangslage" section used to confirm Google is
      // disabled in the first place — and throw a normal Error before
      // ever calling signInWithOAuth if it isn't enabled, so it's caught
      // by the exact same try/catch UI callers already have for
      // login()/register(). Fails open (falls through to the normal call)
      // if the settings check itself doesn't come back cleanly — a
      // secondary, best-effort request should never itself block sign-in.
      try {
        const settingsResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        });
        if (settingsResponse.ok) {
          const settings = (await settingsResponse.json()) as { external?: Record<string, boolean> };
          if (settings.external?.google === false) {
            throw new Error("Unsupported provider: provider is not enabled");
          }
        }
      } catch (err) {
        // Re-throw our own "not enabled" error (caught by the caller);
        // swallow anything else (network hiccup, unexpected response
        // shape) and fall through to the normal signInWithOAuth() call
        // below instead of blocking sign-in on a best-effort check.
        if (err instanceof Error && err.message === "Unsupported provider: provider is not enabled") {
          throw err;
        }
      }

      // @supabase/ssr uses PKCE. Google therefore returns to a server-side
      // callback that exchanges the one-time code for the cookie session.
      // The application layer has already normalized destinationPath to the
      // /dashboard namespace; URLSearchParams safely encodes it here.
      const callbackUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_SITE_URL!);
      callbackUrl.searchParams.set("next", destinationPath);
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });
      if (error) throw error;
    },

    async exchangeOAuthCode(code: string) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
    },

    async getDesktopHandoffTokens() {
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) return null;
      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
    },

    async logout() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    async requestPasswordReset(email: string) {
      // Deliberately no error thrown/surfaced for "unknown email" here —
      // Supabase itself doesn't distinguish it in the response, matching
      // the anti-enumeration behavior already established for the
      // native apps (Ticket 009 in TimTracker-Starter). Verified against
      // the real backend on 2026-08-25: an unregistered address gets the
      // same 200 {} response a registered one does.
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      });
      if (error) throw error;
    },

    async updatePassword(newPassword: string) {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },

    onAuthStateChange(callback) {
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event) => {
        // Supabase's own AuthChangeEvent also includes
        // MFA_CHALLENGE_VERIFIED; the port's type omits it since this app
        // has no MFA feature (passkeys/MFA are disabled on the Supabase
        // project, confirmed via /auth/v1/settings) and nothing here
        // switches on it.
        callback(event as AuthChangeEvent);
      });
      return () => subscription.unsubscribe();
    },

    async deleteAccount() {
      // Same delete-account Edge Function the native app calls (see
      // Infrastructure/Auth/SupabaseAccountService.swift in
      // TimTracker-Starter) — auth required (reads the caller's own JWT
      // server-side), no request body. Returns { deleted: true } on
      // success; functions.invoke() surfaces a non-2xx response as
      // `error` rather than throwing itself, so it must be checked
      // explicitly like every other Supabase call in this file.
      //
      // invokeAuthenticated(), not client.functions.invoke() directly —
      // see that helper's own comment: SupabaseClient.functions sends a
      // static publishable-key bearer token by default, never the
      // signed-in user's JWT, which this auth:"user"-gated function
      // rejects with a 401 that looks like an auth bug but isn't one.
      const { error } = await invokeAuthenticated(client, "delete-account");
      if (error) throw await describeFunctionsError(error);
    },

    async getProfile(): Promise<Profile> {
      // client.auth.getUser() (not getSession()) deliberately — it
      // revalidates against Supabase Auth server-side rather than trusting
      // a possibly-stale local JWT, same reasoning Supabase's own docs
      // give for any call whose result gets displayed/trusted rather than
      // used purely for a client-side route guard.
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      const rawDisplayName = data.user.user_metadata?.display_name;
      return {
        email: data.user.email ?? "",
        // user_metadata is untyped (Record<string, unknown>) — narrow to
        // string explicitly rather than trusting the cast, since anything
        // could technically end up in there (e.g. a stray boolean/number
        // from a bug elsewhere) and this value flows straight into the
        // nav/settings UI.
        displayName: typeof rawDisplayName === "string" ? rawDisplayName : null,
        createdAt: data.user.created_at,
      };
    },

    async updateDisplayName(displayName: string | null) {
      // Supabase merges `data` into the existing user_metadata rather than
      // replacing it wholesale, so this only ever touches the
      // `display_name` key — explicitly setting it to `null` (rather than
      // omitting it) is what "clears back to the email fallback" means
      // here; getProfile()'s `typeof rawDisplayName === "string"` check
      // above treats stored `null` the same as "never set".
      const { error } = await client.auth.updateUser({
        data: { display_name: displayName },
      });
      if (error) throw error;
    },

    async changeEmail(newEmail: string, currentPassword: string) {
      // getUser() (not getSession()), same reasoning as getProfile() above
      // — revalidates against the Auth server rather than trusting a
      // possibly-stale local JWT for the email this re-auth check hinges on.
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const currentEmail = userData.user.email;
      if (!currentEmail) {
        throw new Error("Current session has no email address on file.");
      }

      // Re-authentication: signInWithPassword against the session's OWN
      // email, not anything caller-supplied — confirms the caller actually
      // knows the account's current password before a security-sensitive
      // change, same principle the ticket asks for. A failure here is
      // always "wrong password" from the caller's perspective (the email is
      // already known-correct), never "unknown account".
      const { error: reauthError } = await client.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (reauthError) throw new ReauthenticationFailedError();

      const { error: updateError } = await client.auth.updateUser({ email: newEmail });
      if (updateError) {
        // AuthApiError.code is "email_exists" for this case — verified
        // against the real local Docker stack (see
        // docs/tickets/025-profile-email-change.md). The message-pattern
        // fallback only applies when `code` is missing entirely (e.g. a
        // future SDK/GoTrue version that stops populating it), so a
        // same-shaped-but-unrelated 422 doesn't get misclassified.
        const isEmailAlreadyInUse =
          updateError instanceof AuthApiError &&
          (updateError.code === "email_exists" ||
            (!updateError.code && /already.*registered/i.test(updateError.message)));
        throw isEmailAlreadyInUse ? new EmailAlreadyInUseError() : updateError;
      }
    },

    async changePassword(newPassword: string, currentPassword: string) {
      // getUser() (not getSession()), same reasoning as changeEmail() above
      // — revalidates against the Auth server rather than trusting a
      // possibly-stale local JWT for the email this re-auth check hinges on.
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const currentEmail = userData.user.email;
      if (!currentEmail) {
        throw new Error("Current session has no email address on file.");
      }

      // Re-authentication: signInWithPassword against the session's OWN
      // email with the CALLER-supplied current password — this is the
      // security check the ticket's AK requires and that plain
      // `updateUser({ password })` does not perform on its own (a valid
      // session alone would otherwise be enough). A failure here is always
      // "wrong current password" from the caller's perspective (the email
      // is already known-correct), never "unknown account". Nothing is
      // changed when this fails.
      const { error: reauthError } = await client.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (reauthError) throw new ReauthenticationFailedError();

      const { error: updateError } = await client.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },
  };
}
