import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import {
  getActiveWorkspaceTimeZone,
  getTeamTime,
  getWorkspaceSwitcherData,
  listWorkspaceMembers,
  type TeamTimeRow,
  type WorkspaceMemberRow,
} from "@/lib/application/workspace";
import { addDaysIso, formatDayLabel, formatDuration, resolveHistoryRange } from "@/lib/format";
import { isoToday } from "@/lib/application/dashboard";
import { languageCodeToLocale } from "@/lib/domain/language";
import { AccessGate } from "@/components/AccessGate";
import { teamTimes, projects as projectsI18n, t, type Translated } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// "Team-Zeiten für Admins" (Ticket 121) — operates on the ACTIVE workspace
// (see DashboardNav.tsx's own comment on why this isn't a
// `/dashboard/workspaces/[workspaceId]/...` route like members/settings:
// the project filter needs repos.projects.getAll(), itself
// active-workspace-scoped, Ticket 103). Plain GET form, no Client
// Component — same "keep it simple" philosophy as history/page.tsx's own
// filters, and this V1 has no row-level actions at all (AK: "Download/
// Korrektur sind gesonderter Umfang").
//
// `list_workspace_team_time` (TimTracker-Starter repo) is the sole
// authoritative "is this caller an owner/admin" check — this page never
// duplicates that check, same reasoning as members/invitations/settings
// pages' own comments. A plain member navigating here directly gets the
// RPC's 42501, caught below and shown as a clear message instead of a
// crash.
// Ticket 185 (selbst gefunden): browser-tab title.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, teamTimes.pageTitle) };
}

export default async function TeamTimesPage({
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
    return <AccessGate title={t(lang, teamTimes.pageTitle)} status={subscription.status} lang={lang} />;
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

  let rows: TeamTimeRow[] | null = null;
  let members: WorkspaceMemberRow[] = [];
  let isForbidden = false;
  try {
    [rows, members] = await Promise.all([
      getTeamTime(repos, activeWorkspaceId, from, to, { userId: requestedMemberId, projectId }),
      // Only "active" rows are offered as filter OPTIONS — a since-removed
      // member's historical rows still show up in the unfiltered result
      // (the RPC's own AK-required behavior), just not as a selectable
      // filter target, same "discoverable options only" reasoning as
      // history/page.tsx's own project dropdown (archived projects ARE
      // still listed there, but only because they can still legitimately
      // be filtered on — a removed member cannot be re-selected by design,
      // filtering their OWN history is still possible by visiting the
      // unfiltered view and reading their row directly).
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
    { label: teamTimes.last7Days, from: addDaysIso(today, -6), to: today },
    { label: teamTimes.last30Days, from: addDaysIso(today, -29), to: today },
  ];

  const byDay = new Map<string, TeamTimeRow[]>();
  for (const row of rows ?? []) {
    const bucket = byDay.get(row.day) ?? [];
    bucket.push(row);
    byDay.set(row.day, bucket);
  }
  const days = Array.from(byDay.entries()).sort(([a], [b]) => b.localeCompare(a));

  const filterQuery = `${projectId ? `&project=${encodeURIComponent(projectId)}` : ""}${requestedMemberId ? `&member=${encodeURIComponent(requestedMemberId)}` : ""}`;

  return (
    <main className="flex animate-content-fade-in flex-col gap-6 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, teamTimes.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{t(lang, teamTimes.pageDescription)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <nav className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <a
              key={preset.label.de}
              href={`/dashboard/team-times?from=${preset.from}&to=${preset.to}${filterQuery}`}
              className="rounded-md px-2.5 py-1 text-sm text-foreground/70 hover:text-foreground"
            >
              {t(lang, preset.label)}
            </a>
          ))}
        </nav>

        <form action="/dashboard/team-times" className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            {t(lang, teamTimes.fromLabel)}
            <input type="date" name="from" defaultValue={from} className="rounded-md border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            {t(lang, teamTimes.toLabel)}
            <input type="date" name="to" defaultValue={to} className="rounded-md border border-line px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            {t(lang, teamTimes.memberLabel)}
            <select name="member" defaultValue={requestedMemberId ?? ""} className="rounded-md border border-line px-2 py-1">
              <option value="">{t(lang, teamTimes.allMembers)}</option>
              {activeMembers.map((member) => (
                <option key={member.userId} value={member.userId ?? ""}>
                  {member.displayName ?? member.email}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            {t(lang, teamTimes.projectLabel)}
            <select name="project" defaultValue={projectId ?? ""} className="rounded-md border border-line px-2 py-1">
              <option value="">{t(lang, teamTimes.allProjects)}</option>
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
            {t(lang, teamTimes.apply)}
          </button>
        </form>
      </div>

      <p>
        <span className="font-mono text-xs tabular-nums text-foreground/50">
          {formatDayLabel(from, locale)} – {formatDayLabel(to, locale)}
          {activeProjectFilter && ` · ${activeProjectFilter.name}`}
          {activeMember && ` · ${activeMember.displayName ?? activeMember.email}`}
        </span>
      </p>

      {rows === null ? (
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, isForbidden ? teamTimes.forbiddenError : teamTimes.loadError)}
        </p>
      ) : days.length === 0 ? (
        <p className="text-sm text-foreground/60">{t(lang, teamTimes.emptyState)}</p>
      ) : (
        <div className="flex flex-col divide-y divide-line border-t border-line">
          {days.map(([day, dayRows]) => (
            <div key={day} className="flex flex-col gap-1 py-3">
              <span className="text-sm font-medium">{formatDayLabel(day, locale)}</span>
              <ul className="flex flex-col gap-1">
                {dayRows
                  .slice()
                  .sort((a, b) => (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email))
                  .map((row) => (
                    <li key={`${row.userId}-${row.day}`} className="flex items-center justify-between gap-4 pl-4 text-sm">
                      <span className="text-foreground/70">{row.displayName ?? row.email}</span>
                      <span className="font-mono tabular-nums text-foreground/70">{formatDuration(row.totalSeconds, locale)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
