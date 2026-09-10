import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode, getLanguagePreference } from "@/lib/application/language";
import { getProfile } from "@/lib/application/auth";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getDailyGoalHours } from "@/lib/application/daily-goal";
import { SettingsClient } from "@/components/SettingsClient";
import { settings, t } from "@/lib/i18n";

// "Einstellungen" — Server Component for the initial language-preference
// fetch, same split as projects/page.tsx (fetch + gate here, interactivity
// in a Client Component). Deliberately has NO canUseApp() access gate,
// unlike Heute/Historie/Projekte: account-level actions (language,
// deleting your own account) must stay reachable even without an active
// trial/subscription — same reasoning Ticket 011 states explicitly for
// the billing/upgrade action on ./billing, just applied here too since
// "Account löschen" has the identical requirement (a canceled/expired
// user must still be able to exercise their GDPR deletion right). Same
// reasoning now also covers fetching `subscription` itself below (Ticket
// 041) — the new overview card must render for a `status: "none"` user
// too (see its own edge-case handling in SettingsClient.tsx), not just an
// entitled one.
//
// Ticket 041: also fetches getSubscriptionStatus() — the exact same call
// billing/page.tsx already makes — so SettingsClient's new compact
// subscription overview card can render without a second client-side
// round trip, replacing the previous bare "Abo verwalten →" link that
// used to live directly in this file.
// Ticket 185 (selbst gefunden): browser-tab title.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, settings.pageTitle) };
}

export default async function SettingsPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const [language, lang, profile, subscription, dailyGoalHours] = await Promise.all([
    getLanguagePreference(repos),
    getEffectiveLanguageCode(repos, headerList.get("accept-language")),
    getProfile(repos),
    getSubscriptionStatus(repos),
    getDailyGoalHours(repos),
  ]);

  return (
    <main className="flex animate-content-fade-in flex-col gap-7 py-8 sm:py-10">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-brand uppercase">Workspace</p>
        <h1 className="text-[34px] font-semibold tracking-[-0.035em] sm:text-[40px]">{t(lang, settings.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          {t(lang, settings.pageDescription)}
        </p>
      </div>
      <SettingsClient
        initialLanguage={language}
        profile={profile}
        subscription={subscription}
        lang={lang}
        initialDailyGoalHours={dailyGoalHours}
      />
    </main>
  );
}
