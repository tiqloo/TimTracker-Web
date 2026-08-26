import Link from "next/link";
import { getRepositories } from "@/lib/application/server";
import { getLanguagePreference } from "@/lib/application/language";
import { SettingsClient } from "@/components/SettingsClient";

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
  const language = await getLanguagePreference(repos);

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-xl font-semibold">Einstellungen</h1>
      <SettingsClient initialLanguage={language} />
      <Link href="/dashboard/settings/billing" className="text-sm underline">
        Abo verwalten
      </Link>
    </main>
  );
}
