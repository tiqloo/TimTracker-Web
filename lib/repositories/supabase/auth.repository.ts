import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthRepository } from "../auth.repository";

export function createSupabaseAuthRepository(
  client: SupabaseClient,
): AuthRepository {
  return {
    async register(email: string, password: string) {
      const { error } = await client.auth.signUp({ email, password });
      if (error) throw error;
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
      // native apps (Ticket 009 in TimTracker-Starter).
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      });
      if (error) throw error;
    },
  };
}
