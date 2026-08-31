import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode, getLanguagePreference } from "@/lib/application/language";
import { getProfile } from "@/lib/application/auth";
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
// user must still be able to exercise their GDPR deletion right).
export default async function SettingsPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const [language, lang, profile] = await Promise.all([
    getLanguagePreference(repos),
    getEffectiveLanguageCode(repos, headerList.get("accept-language")),
    getProfile(repos),
  ]);

  return (
    <main className="flex flex-col gap-8 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t(lang, settings.pageTitle)}</h1>
      <SettingsClient initialLanguage={language} profile={profile} lang={lang} />
      <Link
        href="/dashboard/settings/billing"
        className="text-sm text-foreground/70 hover:text-foreground"
      >
        {t(lang, settings.manageSubscriptionLink)}
      </Link>
    </main>
  );
}
