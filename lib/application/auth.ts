// Application core (use cases) — mirrors SupabaseAuthService.swift.
// Driving adapters (pages) call these functions, never
// lib/repositories/* or lib/composition-root.ts directly.
import type { Repositories } from "@/lib/repositories/repositories";
import type { AuthChangeEvent } from "@/lib/repositories/auth.repository";
// Type-only re-export so app/* can name this type without importing
// lib/repositories/* directly (blocked by eslint.config.mjs) — same
// pattern lib/composition-root.ts uses for `Repositories` itself.
export type { AuthChangeEvent } from "@/lib/repositories/auth.repository";

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
