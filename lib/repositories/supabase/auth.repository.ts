import { AuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import {
  EmailAlreadyInUseError,
  ReauthenticationFailedError,
  type AuthChangeEvent,
  type AuthRepository,
} from "../auth.repository";
import type { Profile } from "@/lib/domain/profile";
import { describeFunctionsError, invokeAuthenticated } from "./invoke-authenticated";

export function createSupabaseAuthRepository(
  client: SupabaseClient,
): AuthRepository {
  return {
    async register(email: string, password: string) {
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
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
        },
      });
      if (error) throw error;
      // data.session is null when Supabase is waiting on email
      // confirmation, populated when signup logs the user in immediately
      // (local/dev config, or a project with confirmations disabled).
      return { emailConfirmationRequired: data.session === null };
    },

    async login(email: string, password: string) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
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
