import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getTodayBreakdown, getTodayEntries, getWeekComparison } from "@/lib/application/dashboard";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { getDailyGoalHours } from "@/lib/application/daily-goal";
import { getActiveWorkspaceTimeFormat } from "@/lib/application/workspace";
import { canUseApp } from "@/lib/domain/subscription";
import { DayDetail } from "@/components/DayDetail";
import { AccessGate } from "@/components/AccessGate";
import { TodayLiveRefresh } from "@/components/TodayLiveRefresh";
import { dayDetail, t, today } from "@/lib/i18n";

// Ticket 185 (selbst gefunden): browser-tab title. Same
// getEffectiveLanguageCode() resolution as the page component below —
// React's cache() wrapper (lib/application/server.ts/language.ts) means
// this doesn't cost a second real fetch, same reasoning as every other
// (dashboard)/*-page independently resolving `lang` for its own strings.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, today.pageTitle) };
}

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

  // Ticket 040: projectId -> colorHex lookup for DayDetail's timeline
  // segments, same `repos.projects.getAll()` call history/page.tsx already
  // makes directly on its injected Repositories instance (getAll()
  // includes archived projects — Ticket 040's edge case: an archived
  // project's past color must keep showing, archiving isn't deletion).
  const [breakdown, entries, allProjects, dailyGoalHours, timeFormat] = await Promise.all([
    getTodayBreakdown(repos),
    getTodayEntries(repos),
    repos.projects.getAll(),
    getDailyGoalHours(repos),
    getActiveWorkspaceTimeFormat(repos),
  ]);
  const projectColors = Object.fromEntries(
    allProjects.map((project) => [project.id, project.colorHex]),
  );
  // Ticket 045: needs today's already-fetched total (breakdown.day/
  // .totalSeconds) as its comparison point, so it runs after the
  // Promise.all above rather than inside it — one extra getHistory() call
  // (reused, no new repository method) for the current week's prior days.
  const weekComparison = await getWeekComparison(repos, breakdown.day, breakdown.totalSeconds);
  const nowMs = currentTimeMs();
  const entriesVersion = entries
    .map((entry) => `${entry.id}:${entry.updatedAt}:${entry.endTime ?? "running"}`)
    .join("|");

  return (
    // animate-content-fade-in (globals.css, Ticket 048): the ticket's
    // "Karten/Seiteninhalt beim Laden: leichter Fade-In" requirement —
    // applied to every (dashboard)/* page's own top-level element (which
    // remounts on each client-side navigation, unlike the persistent
    // app/(dashboard)/layout.tsx shell around it), so a fade plays on
    // every page visit, not just the very first full load. Same class
    // reused verbatim on AuthCard.tsx's card and SupportClient.tsx's
    // wrapper rather than redefined per file.
    <main className="flex animate-content-fade-in flex-col gap-6 py-8 sm:py-10">
      <TodayLiveRefresh />
      {/* Ticket 048: "Dashboard H1" tier of the new type scale (32-36px) —
          was text-2xl (24px) on every (dashboard)/* page's top heading, one
          identical arbitrary-value bump applied consistently across all of
          them (settings/projects/history/billing/support/changelog/
          helpcenter pages, plus SupportClient.tsx's own greeting h1). Flat
          single value, not a responsive two-tier class, matching this
          repo's "keep it simple" convention for dashboard chrome (the
          public homepage's Hero is the one heading that DOES need
          responsive sizing, see app/page.tsx). */}
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-brand uppercase">Übersicht</p>
        <h1 className="text-[34px] font-semibold tracking-[-0.035em] sm:text-[40px]">{t(lang, today.pageTitle)}</h1>
      </div>

      <section className="rounded-2xl border border-line/90 bg-surface p-5 shadow-[0_18px_50px_-36px_rgba(24,24,23,0.35)] sm:p-8">
        <DayDetail
          key={entriesVersion}
          breakdown={breakdown}
          entries={entries}
          nowMs={nowMs}
          emptyMessage={t(lang, dayDetail.noEntriesToday)}
          emptyMessageDetail={t(lang, dayDetail.noEntriesTodayDetail)}
          lang={lang}
          timeFormat={timeFormat}
          projectColors={projectColors}
          dailyGoalHours={dailyGoalHours}
          weekComparison={weekComparison}
        />
      </section>

      <Link href="/dashboard/history" className="w-fit text-sm font-medium text-brand hover:underline">
        {t(lang, today.goToHistory)} →
      </Link>
    </main>
  );
}
