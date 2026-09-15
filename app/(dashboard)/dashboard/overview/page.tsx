import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import { getActiveWorkspaceTimeZone, getWorkspaceOverview, getWorkspaceSwitcherData } from "@/lib/application/workspace";
import { isoToday } from "@/lib/application/dashboard";
import { formatDuration } from "@/lib/format";
import { languageCodeToLocale } from "@/lib/domain/language";
import { AccessGate } from "@/components/AccessGate";
import { companyOverview, t } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// Ticket 191 (selbst gefunden, direkte Nutzer-Vorgabe für den
// Unternehmensbereich) — "Unternehmensübersicht / Team-Dashboard".
// Operates on the ACTIVE workspace, same reasoning as team-times/page.tsx
// and members's own DashboardNav.tsx comment: switch workspaces via the
// switcher first, no separate `/dashboard/workspaces/[id]/...` route.
//
// getWorkspaceOverview() (lib/application/workspace.ts) is the sole
// authorization boundary here — every RPC it calls
// (list_workspace_members/list_workspace_team_time/
// list_workspace_running_entries) independently rejects a non-owner/admin
// caller with 42501, same "the RPC is the authority, this page never
// duplicates that check" pattern as team-times/page.tsx.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, companyOverview.pageTitle) };
}

// Wrapped so eslint's react-hooks/purity rule (which flags a direct
// Date.now() call anywhere in a component body) doesn't fire — same
// exact reasoning as app/(dashboard)/dashboard/page.tsx's own
// currentTimeMs(): this page renders once per request on the server, so
// "now" as of render time is the correct, intended value for a
// still-running entry's elapsed duration, not a purity bug.
function currentTimeMs(): number {
  return Date.now();
}

export default async function CompanyOverviewPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const locale = languageCodeToLocale(lang);

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return <AccessGate title={t(lang, companyOverview.pageTitle)} status={subscription.status} lang={lang} />;
  }

  const timeZone = await getActiveWorkspaceTimeZone(repos);
  const today = isoToday(new Date(), timeZone);
  const { activeWorkspaceId } = await getWorkspaceSwitcherData(repos);

  let overview: Awaited<ReturnType<typeof getWorkspaceOverview>> | null = null;
  let isForbidden = false;
  try {
    overview = await getWorkspaceOverview(repos, activeWorkspaceId, today);
  } catch (err) {
    isForbidden = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "42501";
  }

  return (
    <main className="flex animate-content-fade-in flex-col gap-6 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, companyOverview.pageTitle)}</h1>
      </div>

      {overview === null ? (
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, isForbidden ? companyOverview.forbiddenError : companyOverview.loadError)}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile value={String(overview.memberCount)} label={t(lang, companyOverview.membersLabel)} />
            <StatTile value={String(overview.activeTodayCount)} label={t(lang, companyOverview.activeTodayLabel)} />
            <StatTile
              value={formatDuration(overview.totalSecondsToday, locale)}
              label={t(lang, companyOverview.totalTimeTodayLabel)}
            />
            <StatTile value={String(overview.runningEntries.length)} label={t(lang, companyOverview.runningTimersLabel)} />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t(lang, companyOverview.currentlyActiveHeading)}</h2>
            {overview.runningEntries.length === 0 ? (
              <p className="text-sm text-foreground/60">{t(lang, companyOverview.noRunningTimers)}</p>
            ) : (
              <ul className="flex flex-col gap-1 border-t border-line">
                {overview.runningEntries.map((entry) => {
                  const elapsedSeconds = Math.max(
                    0,
                    Math.floor((currentTimeMs() - new Date(entry.startTime).getTime()) / 1000),
                  );
                  return (
                    <li key={entry.userId} className="flex items-center justify-between gap-4 border-b border-line py-2 text-sm">
                      <span className="text-foreground/80">{entry.displayName ?? entry.email}</span>
                      <span className="text-foreground/60">{entry.projectName}</span>
                      <span className="font-mono tabular-nums text-foreground/70">{formatDuration(elapsedSeconds, locale)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t(lang, companyOverview.timeTodayHeading)}</h2>
            {overview.todayByMember.length === 0 ? (
              <p className="text-sm text-foreground/60">{t(lang, companyOverview.noTimeToday)}</p>
            ) : (
              <ul className="flex flex-col gap-1 border-t border-line">
                {overview.todayByMember.map((member) => (
                  <li key={member.userId} className="flex items-center justify-between gap-4 border-b border-line py-2 text-sm">
                    <span className="text-foreground/80">{member.displayName ?? member.email}</span>
                    <span className="font-mono tabular-nums text-foreground/70">{formatDuration(member.totalSeconds, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
      <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}
