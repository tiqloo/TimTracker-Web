// Application core (use cases) — the language-preference equivalent of
// SettingsViewModel's language handling on the native app, minus the
// live-environment-value propagation Ticket 004 does with SwiftUI's
// .environment(\.locale:) (there's no direct web equivalent to "re-render
// every open window without a request" — see language.ts's SCOPE NOTE and
// the Phase 1e ticket section for the full reasoning). Driving adapters
// (pages) call these functions, never lib/repositories/* directly.
import { cache } from "react";
import type { Repositories } from "@/lib/repositories/repositories";
import { resolveLanguageCode, type AppLanguage } from "@/lib/domain/language";
export type { AppLanguage } from "@/lib/domain/language";

export async function getLanguagePreference(repos: Repositories): Promise<AppLanguage> {
  return repos.language.get();
}

export async function setLanguagePreference(
  repos: Repositories,
  language: AppLanguage,
): Promise<void> {
  return repos.language.set(language);
}

// Resolves the effective "de" | "en" code for the CURRENT request, given
// the visitor's Accept-Language header as the "system" fallback signal —
// used by app/layout.tsx to set <html lang> and by pages that do their
// own Intl-based formatting (e.g. settings/billing's trial-end date).
// Accept-Language itself is read by the CALLER (a Server Component using
// next/headers' headers()) rather than here, keeping this file free of
// any Next.js-specific API — same reasoning as every other
// lib/application/* file staying framework-agnostic where it can.
//
// Ticket 072: wrapped in React's cache() — app/(dashboard)/layout.tsx and
// the active page.tsx both call this independently on every navigation
// (documented convention, see layout.tsx's own comment). repos.language
// is a cookie read (lib/repositories/cookie/language.server.ts), not a
// network round trip, so this specific dedupe is a minor, mostly
// consistency-motivated win by itself (identical result guaranteed from
// one cookies() snapshot instead of two) — the real payoff of the same
// pattern is getProfile()/getSubscriptionStatus() below, which DO hit
// Supabase. cache() dedupes calls with the same arguments within one
// request; relies on getRepositories() (server.ts) also being
// cache()-wrapped so `repos` is reference-equal between the layout's call
// and the page's call, not just the header string.
export const getEffectiveLanguageCode = cache(async (
  repos: Repositories,
  acceptLanguageHeader: string | null,
): Promise<"de" | "en"> => {
  const preference = await getLanguagePreference(repos);
  return resolveLanguageCode(preference, acceptLanguageHeader);
});
