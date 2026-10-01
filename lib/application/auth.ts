// Application core (use cases) — mirrors SupabaseAuthService.swift.
// Driving adapters (pages) call these functions, never
// lib/repositories/* or lib/composition-root.ts directly.
import { cache } from "react";
import type { Repositories } from "@/lib/repositories/repositories";
import { isWorkspaceOnlyPath, productFeatures } from "../config/product-features.ts";
import type { AuthChangeEvent } from "@/lib/repositories/auth.repository";
import type { Profile } from "@/lib/domain/profile";
import { normalizeDisplayNameInput } from "../domain/profile.ts";
import { UnauthorizedError, ValidationError } from "../domain/application-error.ts";
import { normalizeDashboardRedirect } from "../domain/redirect-target.ts";
// Type-only re-export so app/* can name this type without importing
// lib/repositories/* directly (blocked by eslint.config.mjs) — same
// pattern lib/composition-root.ts uses for `Repositories` itself.
export type { AuthChangeEvent } from "@/lib/repositories/auth.repository";
export type { Profile } from "@/lib/domain/profile";
// Value re-export (not type-only): app/* needs `instanceof` checks against
// these to show the right error message — same reasoning as re-exporting
// the port's types above, just for runtime-checkable classes instead.
export {
  EmailAlreadyInUseError,
  EmailAlreadyRegisteredError,
  ReauthenticationFailedError,
} from "../repositories/auth.repository.ts";

export { UnauthorizedError } from "../domain/application-error.ts";

export async function requireUser(repos: Repositories): Promise<string> {
  const userId = await repos.auth.getAuthenticatedUserId();
  if (!userId) throw new UnauthorizedError();
  return userId;
}

// Ticket 102: `redirectTo` (raw, from `?redirectTo=` — see RegisterForm.tsx)
// is normalized here, at the application boundary, before it ever reaches
// the adapter — the same defense-in-depth reasoning signInWithGoogle below
// already applies. Without this, an unvalidated value would flow straight
// into Supabase's outbound confirmation-email link (see the adapter),
// turning a would-be UI-only bug into a genuine open-redirect vector.
export async function register(
  repos: Repositories,
  email: string,
  password: string,
  redirectTo?: string,
): Promise<{ emailConfirmationRequired: boolean }> {
  return repos.auth.register(
    email,
    password,
    normalizeDashboardRedirect(redirectTo ?? "/dashboard/get-started"),
  );
}

export async function login(
  repos: Repositories,
  email: string,
  password: string,
): Promise<void> {
  return repos.auth.login(email, password);
}

// Ticket 077 — see lib/repositories/auth.repository.ts#signInWithGoogle's
// own doc for the full contract. The destination is normalized here so no
// adapter can turn OAuth into an open redirect.
export async function signInWithGoogle(
  repos: Repositories,
  destinationPath: string,
): Promise<void> {
  return repos.auth.signInWithGoogle(normalizeDashboardRedirect(destinationPath));
}

export async function completeOAuthSignIn(
  repos: Repositories,
  code: string,
): Promise<void> {
  return repos.auth.exchangeOAuthCode(code);
}

// Ticket 079 (TimTracker-Starter repo, überarbeitet 2026-09-03) — siehe
// lib/repositories/auth.repository.ts#getDesktopHandoffTokens's eigene Doku.
export async function getDesktopHandoffTokens(
  repos: Repositories,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  return repos.auth.getDesktopHandoffTokens();
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
//
// Ticket 072: wrapped in React's cache() — app/(dashboard)/layout.tsx
// (display name in DashboardNav) and several page.tsx files (settings,
// get-started, support) each call this independently on the same
// navigation, and repos.auth.getProfile() is a real Supabase Auth network
// call (client.auth.getUser(), revalidated server-side — see
// lib/repositories/supabase/auth.repository.ts), not a local read.
// cache() collapses those into one call per request; requires
// getRepositories() (server.ts) to also be cache()-wrapped so `repos` is
// the same instance across call sites, not just structurally equal.
export const getProfile = cache(async (repos: Repositories): Promise<Profile> => {
  return repos.auth.getProfile();
});

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

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Ticket 029. Fast, user-facing mirror of the 'avatars' Storage bucket's
// own file_size_limit/allowed_mime_types (TimTracker-Starter repo
// migration) — the bucket enforces both authoritatively regardless of
// this check, same "client check is a courtesy, server check is the real
// gate" relationship as uploadWorkspaceLogo (lib/application/workspace.ts).
export async function uploadAvatar(repos: Repositories, file: File): Promise<string> {
  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    throw new ValidationError("The avatar must be a PNG, JPEG or WebP image.");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new ValidationError("The avatar must not exceed 2 MB.");
  }
  return repos.auth.updateAvatar(file);
}

export async function removeAvatar(repos: Repositories): Promise<void> {
  await repos.auth.removeAvatar();
}

// Storage RLS (the bucket's own SELECT policy, TimTracker-Starter repo
// migration) is the sole authoritative "is this the owning user" check for
// whether the signed URL request itself succeeds — this function does not
// duplicate that check, same relationship as getWorkspaceLogoUrl
// (lib/application/workspace.ts).
export async function getAvatarUrl(repos: Repositories, avatarPath: string): Promise<string> {
  return repos.auth.getAvatarUrl(avatarPath);
}

// Ticket 164 — "Unternehmens-Onboarding fortsetzbar machen". Set the
// moment a signed-in user lands on the company-onboarding step
// (app/(auth)/register/company/page.tsx) and cleared once they finish or
// explicitly skip it (components/CreateCompanyWorkspaceClient.tsx).
export async function setOnboardingIntent(repos: Repositories, intent: "organization" | null): Promise<void> {
  await repos.auth.setOnboardingIntent(intent);
}

// Ticket 164/168 — the ONE place that decides "where does a just-signed-in
// user actually go", called from every post-auth success path (email/
// password login, the SIGNED_IN-event path used for email-confirmation
// links and Google OAuth landing on /login, and the direct OAuth callback
// route) so a stale/abandoned company onboarding is resumed no matter
// which of the three ways the user re-authenticated.
//
// An explicit, already-validated non-dashboard destination always wins —
// desktop-app token handoff (Ticket 079) and workspace-invitation
// acceptance (Ticket 102) are themselves the reason this specific sign-in
// happened; silently redirecting to company onboarding instead would
// strand the desktop app waiting for tokens that never arrive, or drop an
// invitation the user was one click from accepting. Both are exact-match
// paths from lib/domain/redirect-target.ts's own allowlist, checked the
// same way here.
export async function resolvePostAuthDestination(repos: Repositories, requestedDestination: string): Promise<string> {
  if (!productFeatures.workspaceAndTeam) {
    return isWorkspaceOnlyPath(requestedDestination.split(/[?#]/u, 1)[0] ?? "") ? "/dashboard" : requestedDestination;
  }
  if (requestedDestination === "/auth/desktop-complete" || requestedDestination.startsWith("/invite/accept")) {
    return requestedDestination;
  }
  const profile = await getProfile(repos).catch(() => null);
  if (profile?.onboardingIntent === "organization") {
    return "/register/company";
  }
  return requestedDestination;
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
