import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { languageCodeToLocale } from "@/lib/domain/language";
import { formatDayLabel } from "@/lib/format";
import { changelog, t } from "@/lib/i18n";

// "Produkt-Neuerungen" (Ticket 030, TimTracker-Starter repo) — static
// changelog page, footer link from /dashboard/support. Plain Server
// Component, same shape as the Helpcenter page right next to it: every
// entry lives in lib/i18n.ts's `changelog` namespace, seeded with real,
// already-shipped web features pulled from docs/tickets/README.md (dates
// + ticket numbers), not invented. Same no canUseApp()-gate reasoning as
// support/page.tsx.
//
// Uses formatDayLabel (yyyy-MM-dd, local-midnight-anchored), NOT
// formatFullDate (full ISO datetime) — entry.date is a plain date string,
// and formatFullDate's plain `new Date(isoDateTime)` would parse a
// date-only string as UTC midnight, which toLocaleDateString can then
// render as the PREVIOUS calendar day in any timezone west of UTC —
// exactly the timezone/DST bug class lib/format.ts's own comments warn
// about (see formatDayLabel's and dayOfMonthPart's comments there).
export default async function ChangelogPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const locale = languageCodeToLocale(lang);

  return (
    <main className="flex flex-col gap-6 py-8">
      <Link href="/dashboard/support" className="text-sm text-foreground/70 hover:text-foreground">
        {t(lang, changelog.backToSupport)}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t(lang, changelog.pageTitle)}</h1>
      <ul className="flex flex-col divide-y divide-line border-t border-line">
        {changelog.entries.map((entry) => (
          <li key={`${entry.date}-${entry.ticket}`} className="flex flex-col gap-1 py-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-foreground/50">
                {formatDayLabel(entry.date, locale)}
              </span>
              <span className="font-mono text-xs text-foreground/40">#{entry.ticket}</span>
            </div>
            <span className="text-sm font-medium">{t(lang, entry.title)}</span>
            <span className="text-sm text-foreground/70">{t(lang, entry.body)}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
