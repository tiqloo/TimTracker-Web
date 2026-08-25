// Application core (use cases) — mirrors SupabaseAuthService.swift.
// Driving adapters (pages) call these functions, never
// lib/repositories/* or lib/composition-root.ts directly.
import type { Repositories } from "@/lib/repositories/repositories";

export async function register(
  repos: Repositories,
  email: string,
  password: string,
): Promise<void> {
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
