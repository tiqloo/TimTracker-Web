// Driven port for identity/auth — the real gap flagged in the 2026-08-25
// structure review: (auth)/* pages had no port to call, only the
// composition root's data repositories existed. Kept intentionally
// function-shaped (not a class/command hierarchy) — this app is small
// enough that a plain interface is sufficient, per the same review's own
// point 4 about not over-engineering inbound ports.

import type { Profile } from "@/lib/domain/profile";

// Vendor-agnostic mirror of Supabase's AuthChangeEvent string union
// (@supabase/auth-js lib/types.ts). Defined locally rather than imported
// from @supabase/supabase-js — this file is a pure port and must stay
// adapter-free (enforced by eslint.config.mjs's lib/repositories/*.ts
// rule), and lib/application/* isn't allowed to know Supabase's types
// either. Only the subset actually consumed today (the reset-password
// page's PASSWORD_RECOVERY detection, Ticket 018) is used, but the full
// set is kept so a caller narrowing on it doesn't get surprised later.
export type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "PASSWORD_RECOVERY"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED";

export interface AuthRepository {
  // Returns whether Supabase requires email confirmation before a session
  // exists (real-backend testing on 2026-08-25 found the production
  // project has `mailer_autoconfirm: false` — signUp succeeds but returns
  // no session until the confirmation link is clicked, unlike local dev
  // where seed/test users are pre-confirmed). Callers need this to decide
  // whether to redirect straight into the app or show a "check your
  // email" message instead.
  register(
    email: string,
    password: string,
  ): Promise<{ emailConfirmationRequired: boolean }>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  // Sets a new password for the CURRENT session — only meaningful while a
  // Supabase password-recovery session is active (see AuthChangeEvent
  // above), which is how app/(auth)/reset-password/page.tsx uses it.
  updatePassword(newPassword: string): Promise<void>;
  // Subscribes to auth state changes; returns an unsubscribe function.
  // Needed so the UI can detect the PASSWORD_RECOVERY event Supabase's
  // browser client fires when a user lands on a page via a real password
  // reset link (see reset-password/page.tsx) — there is no other way to
  // distinguish "fresh visit" from "arrived via recovery link".
  onAuthStateChange(callback: (event: AuthChangeEvent) => void): () => void;
  // GDPR/DSGVO deletion ("Recht auf Löschung"): invokes the already-
  // deployed delete-account Edge Function (supabase/functions/delete-account
  // in TimTracker-Starter), which deletes the auth.users row for the
  // CURRENT session — projects/time_entries/subscriptions all cascade-
  // delete via FK (see that function's own comment). Mirrors
  // AccountServiceProtocol.deleteAccount() on the native app 1:1 (same
  // Edge Function, same "no body needed, auth required" contract). Does
  // NOT sign the caller out itself — the caller (app/(dashboard)/settings)
  // is responsible for calling logout() afterward, same separation of
  // concerns as every other method on this port.
  deleteAccount(): Promise<void>;
  // Ticket 024 (TimTracker-Starter repo): the current session's identity
  // fields (email, display name, account-creation date). `email`/
  // `createdAt` come straight off `auth.users`; `displayName` is read
  // back out of `user_metadata` (see updateDisplayName below) and is
  // `null` when unset — callers use
  // `lib/domain/profile.ts#displayNameOrFallback` for the email-prefix
  // fallback rather than re-deriving it themselves.
  getProfile(): Promise<Profile>;
  // Persists the display name into `auth.users.user_metadata` via
  // `supabase.auth.updateUser({ data })` — no new table/migration, same
  // as the ticket's AK requires. `displayName` must already be
  // normalized (trimmed, empty -> null) by the caller — see
  // `lib/domain/profile.ts#normalizeDisplayNameInput`; this port method
  // does not re-validate it, same separation of concerns as every other
  // method here (the port is a thin passthrough, normalization is
  // business logic that belongs in lib/domain/*).
  updateDisplayName(displayName: string | null): Promise<void>;
}
