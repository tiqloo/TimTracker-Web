import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthChangeEvent, AuthRepository } from "../auth.repository";

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
  };
}
