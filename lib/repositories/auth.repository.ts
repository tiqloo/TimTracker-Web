// Driven port for identity/auth — the real gap flagged in the 2026-08-25
// structure review: (auth)/* pages had no port to call, only the
// composition root's data repositories existed. Kept intentionally
// function-shaped (not a class/command hierarchy) — this app is small
// enough that a plain interface is sufficient, per the same review's own
// point 4 about not over-engineering inbound ports.

import type { Profile } from "@/lib/domain/profile";

// Ticket 025 (TimTracker-Starter repo, follow-up to 024): thrown by
// changeEmail() below when the requested new address is already in use by
// ANY account. A distinct, named error type — not a plain `Error` carrying
// Supabase's own message ("A user with this email address has already been
// registered", verified against the real local Docker stack) — so the UI
// can show a deliberately generic "this address can't be used" string
// instead. Showing Supabase's raw wording would confirm to the caller that
// the address belongs to a specific other account, exactly the enumeration
// the ticket's AK forbids (same anti-enumeration principle already applied
// to requestPasswordReset() above, Ticket 009).
export class EmailAlreadyInUseError extends Error {
  constructor() {
    super("Email address already in use.");
    this.name = "EmailAlreadyInUseError";
  }
}

// Thrown by changeEmail() (Ticket 025) and changePassword() (Ticket 026)
// when the supplied password confirmation doesn't match the CURRENT
// session's own account — the same underlying failure mode (wrong password
// during a re-authentication check) in both flows, so a single shared type
// is reused rather than a second, near-identical one. The message is kept
// generic ("Password confirmation failed.") for exactly this reason: it
// doesn't say "email" or "current password" specifically, so it reads
// correctly regardless of which flow's re-auth check threw it. Kept
// distinct from EmailAlreadyInUseError so the UI can show the right one of
// the different messages a given form can fail with.
export class ReauthenticationFailedError extends Error {
  constructor() {
    super("Password confirmation failed.");
    this.name = "ReauthenticationFailedError";
  }
}

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
  getAuthenticatedUserId(): Promise<string | null>;
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
  // Ticket 025 (TimTracker-Starter repo, follow-up to 024's read-only email
  // field): changes the CURRENT session's email address. Re-authenticates
  // FIRST via `currentPassword` (AK: "Passwort-Bestätigung" before this
  // security-sensitive change — same re-auth-before-sensitive-action
  // principle as "Account löschen" in Ticket 018, though that flow confirms
  // via a typed confirmation word rather than a password since deletion has
  // no separate secret to check against) using the session's OWN current
  // email — read server-side by the adapter, never trusted from the
  // caller — throwing ReauthenticationFailedError if that fails.
  //
  // On success, requests the change via `supabase.auth.updateUser({
  // email })`. Supabase's default "secure email change" (double-confirm)
  // setting — verified ON for both this project's local Docker stack AND
  // production before implementing this (see
  // docs/tickets/025-profile-email-change.md in TimTracker-Starter for how)
  // — then emails BOTH the old and new address and leaves the old one
  // active for login until both confirmation links are clicked. That's
  // already Supabase's own behavior, nothing else to build for it here.
  //
  // Throws EmailAlreadyInUseError if the new address is already registered
  // to any account — see that error's own comment for why it's a distinct
  // type rather than the raw Supabase error.
  changeEmail(newEmail: string, currentPassword: string): Promise<void>;
  // Ticket 026 (TimTracker-Starter repo, follow-up to 024/025): changes the
  // CURRENT session's password from the settings page — the logged-IN
  // counterpart to updatePassword() above (which only ever runs inside a
  // Supabase password-RECOVERY session reached via an emailed link, where
  // the link itself is the proof of identity). Here there is no such link,
  // so `client.auth.updateUser({ password })` alone would accept the change
  // on nothing but a valid session — a real gap on a briefly-unattended
  // logged-in machine (the ticket's own AK calls this out explicitly).
  //
  // Re-authenticates FIRST via `currentPassword`, same pattern as
  // changeEmail() just above: `client.auth.signInWithPassword()` against the
  // session's OWN current email (read server-side by the adapter, never
  // trusted from the caller), throwing ReauthenticationFailedError if that
  // fails — nothing is changed in that case. Only on success does it call
  // `client.auth.updateUser({ password: newPassword })`.
  //
  // Deliberately reuses updatePassword()'s own underlying Supabase call
  // rather than introducing a third one — the only difference from that
  // method is the re-auth check that runs first.
  changePassword(newPassword: string, currentPassword: string): Promise<void>;
}
