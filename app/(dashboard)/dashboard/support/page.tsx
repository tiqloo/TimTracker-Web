import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { getProfile } from "@/lib/application/auth";
import { displayNameOrFallback } from "@/lib/domain/profile";
import { SupportClient } from "@/components/SupportClient";
import { support, t } from "@/lib/i18n";

// Ticket 185 (selbst gefunden): browser-tab title.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, support.pageTitle) };
}

// "Support" (Ticket 030, TimTracker-Starter repo) — Server Component for
// the initial language/profile fetch, same split as settings/page.tsx
// (fetch here, interactivity in a Client Component).
//
// Deliberately has NO canUseApp() access gate, same reasoning
// settings/page.tsx already documents for itself: account-level help must
// stay reachable even without an active trial/subscription — if anything
// a user with a billing problem needs Support MORE, not less, than one
// with an active subscription.
export default async function SupportPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const [lang, profile] = await Promise.all([
    getEffectiveLanguageCode(repos, headerList.get("accept-language")),
    getProfile(repos),
  ]);
  const displayName = displayNameOrFallback(profile);

  return <SupportClient lang={lang} displayName={displayName} />;
}
