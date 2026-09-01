// Application core (use cases) — mirrors SupabaseAuthService.swift.
// Driving adapters (pages) call these functions, never
// lib/repositories/* or lib/composition-root.ts directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { AuthChangeEvent } from "@/lib/repositories/auth.repository";
import type { Profile } from "@/lib/domain/profile";
import { normalizeDisplayNameInput } from "../domain/profile.ts";
import { UnauthorizedError } from "../domain/application-error.ts";
// Type-only re-export so app/* can name this type without importing
// lib/repositories/* directly (blocked by eslint.config.mjs) — same
// pattern lib/composition-root.ts uses for `Repositories` itself.
export type { AuthChangeEvent } from "@/lib/repositories/auth.repository";
export type { Profile } from "@/lib/domain/profile";
// Value re-export (not type-only): app/* needs `instanceof` checks against
// these to show the right error message — same reasoning as re-exporting
// the port's types above, just for runtime-checkable classes instead.
export { EmailAlreadyInUseError, ReauthenticationFailedError } from "../repositories/auth.repository.ts";

export { UnauthorizedError } from "../domain/application-error.ts";

export async function requireUser(repos: Repositories): Promise<string> {
  const userId = await repos.auth.getAuthenticatedUserId();
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export async function register(
  repos: Repositories,
  email: string,
  password: string,
): Promise<{ emailConfirmationRequired: boolean }> {
  return repos.auth.register(email, password);
}

export async function login(
  repos: Repositories,
  email: string,
  password: string,
): Promise<void> {
  return repos.auth.login(email, password);
}

export async function logout(repos: Repositories): Promise<void> {
  return repos.auth.logout();
}

export async function requestPasswordReset(
  repos: Repositories,
  email: string,
): Promise<void> {
  return repos.auth.requestPasswordReset(email);
}

export async function updatePassword(
  repos: Repositories,
  newPassword: string,
): Promise<void> {
  return repos.auth.updatePassword(newPassword);
}

// Re-exposes the port's subscription as-is (no business logic to add) so
// pages can detect the PASSWORD_RECOVERY event without importing
// lib/repositories/* themselves. Returns an unsubscribe function.
export function onAuthStateChange(
  repos: Repositories,
  callback: (event: AuthChangeEvent) => void,
): () => void {
  return repos.auth.onAuthStateChange(callback);
}

// GDPR/DSGVO account deletion (Ticket 018, Phase 1e) — see
// lib/repositories/auth.repository.ts's deleteAccount() doc for the full
// contract. Deliberately does not also call logout(): the caller
// (app/(dashboard)/settings) decides the post-deletion flow (sign out +
// redirect), same separation as every other use case in this file.
export async function deleteAccount(repos: Repositories): Promise<void> {
  return repos.auth.deleteAccount();
}

// Ticket 024 (TimTracker-Starter repo) — "Profil" section of Einstellungen
// plus the DashboardNav identity display. See
// lib/repositories/auth.repository.ts's getProfile() doc for the field
// contract.
export async function getProfile(repos: Repositories): Promise<Profile> {
  return repos.auth.getProfile();
}

// Normalizes the raw text-input value (trim, empty/whitespace-only -> null)
// before persisting — this is the one call site that does so, so a page
// calling this use case doesn't have to duplicate
// lib/domain/profile.ts#normalizeDisplayNameInput's rule itself.
export async function updateDisplayName(
  repos: Repositories,
  rawDisplayName: string,
): Promise<void> {
  return repos.auth.updateDisplayName(normalizeDisplayNameInput(rawDisplayName));
}

// Ticket 025 (TimTracker-Starter repo) — "E-Mail-Adresse ändern" action in
// the Profil section. Trims the raw new-email input before handing it down
// (same "normalize once, at the use-case boundary" spirit as
// updateDisplayName above); the actual re-auth + change + error mapping is
// business logic that belongs on the port, see
// lib/repositories/auth.repository.ts#changeEmail's own doc.
export async function changeEmail(
  repos: Repositories,
  newEmail: string,
  currentPassword: string,
): Promise<void> {
  return repos.auth.changeEmail(newEmail.trim(), currentPassword);
}

// Ticket 026 (TimTracker-Starter repo) — "Passwort ändern" action in the
// Profil section, the logged-in counterpart to the existing
// updatePassword() use-case above (which only runs inside a password-
// recovery session). Deliberately does NOT trim either password argument
// (unlike changeEmail's email above) — a password is an opaque secret, not
// user-facing text to normalize, and trimming could silently turn a
// deliberately-chosen leading/trailing-space password into a different one.
// New/confirm matching is validated client-side before this is ever called
// (see components/SettingsClient.tsx's PasswordChangeAction) — the re-auth
// check and the actual update are the business logic that belongs on the
// port, see lib/repositories/auth.repository.ts#changePassword's own doc.
export async function changePassword(
  repos: Repositories,
  newPassword: string,
  currentPassword: string,
): Promise<void> {
  return repos.auth.changePassword(newPassword, currentPassword);
}
