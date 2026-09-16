import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import {
  getActiveWorkspaceTimeZone,
  getCompanyAnalytics,
  getWorkspaceSwitcherData,
  listWorkspaceMembers,
  type WorkspaceMemberRow,
} from "@/lib/application/workspace";
import { addDaysIso, formatDuration, resolveHistoryRange } from "@/lib/format";
import { isoToday } from "@/lib/application/dashboard";
import { languageCodeToLocale } from "@/lib/domain/language";
import { AccessGate } from "@/components/AccessGate";
import { companyAnalytics, projects as projectsI18n, t, type Translated } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// Ticket 193 (selbst gefunden, direkte Nutzer-Vorgabe für den
// Unternehmensbereich) — "Unternehmensauswertungen". Operates on the
// ACTIVE workspace, same reasoning/same filter-form shape as
// team-times/page.tsx — this is the aggregated counterpart to that
// page's day×member table (Gesamtzeit/Zeit pro Mitarbeiter/Zeit pro
// Projekt/Arbeitstage over the whole range, not a per-day breakdown).
//
// getCompanyAnalytics() (lib/application/workspace.ts) is the sole
// authorization boundary — list_workspace_project_time itself rejects a
// non-owner/admin caller with 42501, same pattern as every other
// workspace admin page in this app.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, companyAnalytics.pageTitle) };
}

export default async function CompanyAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; member?: string; project?: string }>;
}) {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const locale = languageCodeToLocale(lang);

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return <AccessGate title={t(lang, companyAnalytics.pageTitle)} status={subscription.status} lang={lang} />;
  }

  const timeZone = await getActiveWorkspaceTimeZone(repos);
  const today = isoToday(new Date(), timeZone);
  const params = await searchParams;
  const { from, to } = resolveHistoryRange(today, params);
  const { activeWorkspaceId } = await getWorkspaceSwitcherData(repos);
  const allProjects = await repos.projects.getAll();
  const requestedProjectId = params.project?.trim() || undefined;
  const activeProjectFilter = requestedProjectId ? allProjects.find((project) => project.id === requestedProjectId) : undefined;
  const projectId = activeProjectFilter?.id;
  const requestedMemberId = params.member?.trim() || undefined;

  let analytics: Awaited<ReturnType<typeof getCompanyAnalytics>> | null = null;
  let members: WorkspaceMemberRow[] = [];
  let isForbidden = false;
  try {
    [analytics, members] = await Promise.all([
      getCompanyAnalytics(repos, activeWorkspaceId, from, to, { userId: requestedMemberId, projectId }),
      listWorkspaceMembers(repos, activeWorkspaceId),
    ]);
  } catch (err) {
    isForbidden = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "42501";
  }
  const activeMembers = members.filter((member) => member.status === "active");
  const activeMember = requestedMemberId ? activeMembers.find((member) => member.userId === requestedMemberId) : undefined;

  const activeProjects = allProjects.filter((project) => !project.isArchived);
  const archivedProjects = allProjects.filter((project) => project.isArchived);

  const presets: { label: Translated; from: string; to: string }[] = [
    { label: companyAnalytics.last7Days, from: addDaysIso(today, -6), to: today },
    { label: companyAnalytics.last30Days, from: addDaysIso(today, -29), to: today },
  ];

  const filterQuery = `${projectId ? `&project=${encodeURIComponent(projectId)}` : ""}${requestedMemberId ? `&member=${encodeURIComponent(requestedMemberId)}` : ""}`;

  return (
    <main className="flex animate-content-fade-in flex-col gap-6 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, companyAnalytics.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{t(lang, companyAnalytics.pageDescription)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <nav className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <a
              key={preset.label.de}
              href={`/dashboard/company-analytics?from=${preset.from}&to=${preset.to}${filterQuery}`}
              className="rounded-md px-2.5 py-1 text-sm text-foreground/70 hover:text-foreground"
            >
              {t(lang, preset.label)}
            </a>
          ))}
        </nav>

        <form action="/dashboard/company-analytics" className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            {t(lang, companyAnalytics.fromLabel)}
            <input type="date" name="from" defaultValue={from} className="rounded-md border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            {t(lang, companyAnalytics.toLabel)}
            <input type="date" name="to" defaultValue={to} className="rounded-md border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            {t(lang, companyAnalytics.memberLabel)}
            <select name="member" defaultValue={requestedMemberId ?? ""} className="rounded-md border border-line px-2 py-1">
              <option value="">{t(lang, companyAnalytics.allMembers)}</option>
              {activeMembers.map((member) => (
                <option key={member.userId} value={member.userId ?? ""}>
                  {member.displayName ?? member.email}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {t(lang, companyAnalytics.projectLabel)}
            <select name="project" defaultValue={projectId ?? ""} className="rounded-md border border-line px-2 py-1">
              <option value="">{t(lang, companyAnalytics.allProjects)}</option>
              {activeProjects.length > 0 && (
                <optgroup label={t(lang, projectsI18n.activeProjects)}>
                  {activeProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {archivedProjects.length > 0 && (
                <optgroup label={t(lang, projectsI18n.archivedProjects)}>
                  {archivedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {`${project.name} (${t(lang, projectsI18n.archived)})`}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <button type="submit" className="rounded-md border border-line px-3 py-1">
            {t(lang, companyAnalytics.apply)}
          </button>
        </form>
      </div>

      {activeMember || activeProjectFilter ? (
        <p className="font-mono text-xs tabular-nums text-foreground/50">
          {activeMember && (activeMember.displayName ?? activeMember.email)}
          {activeMember && activeProjectFilter && " · "}
          {activeProjectFilter?.name}
        </p>
      ) : null}

      {analytics === null ? (
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, isForbidden ? companyAnalytics.forbiddenError : companyAnalytics.loadError)}
        </p>
      ) : analytics.totalSeconds === 0 ? (
        <p className="text-sm text-foreground/60">{t(lang, companyAnalytics.emptyState)}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <StatTile value={formatDuration(analytics.totalSeconds, locale)} label={t(lang, companyAnalytics.totalTimeLabel)} />
            <StatTile value={String(analytics.workingDays)} label={t(lang, companyAnalytics.workingDaysLabel)} />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t(lang, companyAnalytics.byMemberHeading)}</h2>
            <ul className="flex flex-col gap-1 border-t border-line">
              {analytics.byMember.map((member) => (
                <li key={member.userId} className="flex items-center justify-between gap-4 border-b border-line py-2 text-sm">
                  <span className="text-foreground/80">{member.displayName ?? member.email}</span>
                  <span className="font-mono tabular-nums text-foreground/70">{formatDuration(member.totalSeconds, locale)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{t(lang, companyAnalytics.byProjectHeading)}</h2>
            <ul className="flex flex-col gap-1 border-t border-line">
              {analytics.byProject.map((project) => (
                <li key={project.projectId} className="flex items-center justify-between gap-4 border-b border-line py-2 text-sm">
                  <span className="text-foreground/80">{project.projectName}</span>
                  <span className="font-mono tabular-nums text-foreground/70">{formatDuration(project.totalSeconds, locale)}</span>
                </li>
              ))}
            </ul>
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
