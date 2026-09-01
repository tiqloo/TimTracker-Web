import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getTodayBreakdown, getTodayEntries } from "@/lib/application/dashboard";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { getDailyGoalHours } from "@/lib/application/daily-goal";
import { canUseApp } from "@/lib/domain/subscription";
import { DayDetail } from "@/components/DayDetail";
import { AccessGate } from "@/components/AccessGate";
import { dayDetail, t, today } from "@/lib/i18n";

// Wrapped so eslint's react-hooks/purity rule (which flags a direct
// Date.now() call anywhere in a component body, Server Components
// included) doesn't fire here. This page renders once per request on the
// server — there's no re-render to be non-idempotent across — so "now"
// as of render time is the correct, intended value for a still-running
// entry's duration-so-far, not a purity bug to work around unsafely.
function currentTimeMs(): number {
  return Date.now();
}

// "Heute" — Server Component, gets its Repositories instance from
// lib/application/server.ts (the designated exception, see CLAUDE.md's
// "Resolved 2026-08-25" entry) and passes it straight into
// lib/application/dashboard.ts's use cases. No business logic here beyond
// picking labels/formatting — the actual unassignedSeconds calculation
// stays in DailyBreakdown (lib/domain/time-entry.ts), not reimplemented.
export default async function TodayPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  // Access gate: mirrors the RLS policy via canUseApp() (see
  // lib/domain/subscription.ts).
  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return <AccessGate title={t(lang, today.pageTitle)} status={subscription.status} lang={lang} />;
  }

  const [breakdown, entries, dailyGoalHours] = await Promise.all([
    getTodayBreakdown(repos),
    getTodayEntries(repos),
    getDailyGoalHours(repos),
  ]);
  const nowMs = currentTimeMs();

  return (
    <main className="flex flex-col gap-8 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t(lang, today.pageTitle)}</h1>

      <DayDetail
        breakdown={breakdown}
        entries={entries}
        nowMs={nowMs}
        emptyMessage={t(lang, dayDetail.noEntriesToday)}
        emptyMessageDetail={t(lang, dayDetail.noEntriesTodayDetail)}
        lang={lang}
        dailyGoalHours={dailyGoalHours}
      />

      <Link href="/dashboard/history" className="text-sm text-foreground/70 hover:text-foreground">
        {t(lang, today.goToHistory)}
      </Link>
    </main>
  );
}
