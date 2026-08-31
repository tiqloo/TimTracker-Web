import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getBreakdownForDay, getEntriesForDay } from "@/lib/application/dashboard";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { languageCodeToLocale } from "@/lib/domain/language";
import { canUseApp } from "@/lib/domain/subscription";
import { formatDayLabel } from "@/lib/format";
import { DayDetail } from "@/components/DayDetail";
import { AccessGate } from "@/components/AccessGate";
import { dayDetail, history, t } from "@/lib/i18n";

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Same purity-rule workaround as app/(dashboard)/page.tsx's currentTimeMs()
// — a named wrapper outside the component body instead of a direct
// Date.now() call inside it. A past day's entries are never actually
// still running in practice, but the shared DayDetail component still
// needs a "now" reference for the (defensive) case where one is.
function currentTimeMs(): number {
  return Date.now();
}

// Arbitrary past-day detail — renders in the exact same layout as "Heute"
// (app/(dashboard)/page.tsx), per Ticket 001/003 and Ticket 018: a past
// day is not a separate design, just the same DayDetail component fed
// with that day's data instead of today's.
export default async function HistoryDayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day } = await params;
  if (!ISO_DAY_RE.test(day)) notFound();

  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const locale = languageCodeToLocale(lang);

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return (
      <AccessGate title={formatDayLabel(day, locale)} status={subscription.status} lang={lang} />
    );
  }

  const [breakdown, entries] = await Promise.all([
    getBreakdownForDay(repos, day),
    getEntriesForDay(repos, day),
  ]);
  const nowMs = currentTimeMs();

  return (
    <main className="flex flex-col gap-8 py-8">
      <div>
        <Link href="/dashboard/history" className="text-sm text-foreground/70 hover:text-foreground">
          {t(lang, history.backToHistory)}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {formatDayLabel(day, locale)}
        </h1>
      </div>

      <DayDetail
        breakdown={breakdown}
        entries={entries}
        nowMs={nowMs}
        emptyMessage={t(lang, dayDetail.noEntriesThisDay)}
        lang={lang}
      />
    </main>
  );
}
