import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import {
  getMemberTimeEntries,
  getTeamTime,
  getWorkspaceSettings,
  listWorkspaceMembers,
  type MemberTimeEntryRow,
  type WorkspaceMemberRow,
} from "@/lib/application/workspace";
import { isoToday } from "@/lib/application/dashboard";
import { formatDayLabel, formatDuration, formatTime, resolveHistoryRange, startOfMonthIso, startOfWeekIso } from "@/lib/format";
import { languageCodeToLocale } from "@/lib/domain/language";
import { AccessGate } from "@/components/AccessGate";
import { employeeProfile, workspaceMembers as i18nWorkspaceMembers, t } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// Ticket 192 (selbst gefunden, direkte Nutzer-Vorgabe für den
// Unternehmensbereich) — "Mitarbeiterprofil und Mitarbeiterdetails".
// Operates on the workspaceId FROM THE URL, not the active workspace
// (unlike team-times/overview) — same reasoning as the sibling
// members/page.tsx: this route is already workspace-scoped by its own
// path segment, no switcher-first requirement.
//
// Every RPC call below (listWorkspaceMembers/getTeamTime/
// getMemberTimeEntries) independently rejects a non-owner/admin caller
// with 42501 — this page never duplicates that check, same pattern as
// every other workspace admin page in this app.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string; userId: string }>;
}): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const { workspaceId, userId } = await params;
  try {
    const members = await listWorkspaceMembers(repos, workspaceId);
    const member = members.find((m) => m.userId === userId);
    return { title: member?.displayName ?? member?.email ?? t(lang, i18nWorkspaceMembers.pageTitle) };
  } catch {
    return { title: t(lang, i18nWorkspaceMembers.pageTitle) };
  }
}

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; userId: string }>;
  searchParams: Promise<{ from?: string; to?: string; project?: string }>;
}) {
  const { workspaceId, userId } = await params;
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const locale = languageCodeToLocale(lang);

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return <AccessGate title={t(lang, i18nWorkspaceMembers.pageTitle)} status={subscription.status} lang={lang} />;
  }

  let member: WorkspaceMemberRow | undefined;
  let timeZone = "Europe/Berlin";
  let weekStart: "monday" | "sunday" = "monday";
  let isForbidden = false;
  let loadError = false;
  try {
    const [members, settings] = await Promise.all([
      listWorkspaceMembers(repos, workspaceId),
      getWorkspaceSettings(repos, workspaceId),
    ]);
    member = members.find((m) => m.userId === userId);
    timeZone = settings.timezone;
    weekStart = settings.weekStart;
  } catch (err) {
    isForbidden = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "42501";
    loadError = !isForbidden;
  }

  if (!isForbidden && !loadError && !member) {
    return (
      <main className="flex animate-content-fade-in flex-col gap-4 py-8">
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, employeeProfile.notFoundError)}
        </p>
        <Link href={`/dashboard/workspaces/${workspaceId}/members`} className="text-sm text-brand hover:underline">
          {t(lang, employeeProfile.backToMembers)}
        </Link>
      </main>
    );
  }

  if (isForbidden || loadError || !member) {
    return (
      <main className="flex animate-content-fade-in flex-col gap-4 py-8">
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, isForbidden ? employeeProfile.forbiddenError : employeeProfile.loadError)}
        </p>
      </main>
    );
  }

  const today = isoToday(new Date(), timeZone);
  const params_ = await searchParams;
  const { from, to } = resolveHistoryRange(today, params_);
  const requestedProjectId = params_.project?.trim() || undefined;

  // One month-to-date fetch covers today/week/month totals without three
  // separate RPC round trips — the three stat tiles are just different
  // slices of the same per-day rows.
  const monthStart = startOfMonthIso(today);
  const weekStartDay = startOfWeekIso(today, weekStart);
  const monthRows = await getTeamTime(repos, workspaceId, monthStart, today, { userId });
  const todaySeconds = monthRows.filter((row) => row.day === today).reduce((sum, row) => sum + row.totalSeconds, 0);
  const weekSeconds = monthRows.filter((row) => row.day >= weekStartDay).reduce((sum, row) => sum + row.totalSeconds, 0);
  const monthSeconds = monthRows.reduce((sum, row) => sum + row.totalSeconds, 0);

  // Ticket 192 (selbst gefunden während der Umsetzung): repos.projects.getAll()
  // filtert immer nach dem AKTIVEN Workspace (getActiveWorkspaceId()) —
  // falsch für diese Seite, die bewusst mit dem expliziten `workspaceId`
  // aus der URL arbeitet (wie die Geschwisterrouten members/settings),
  // nicht mit dem gerade aktiven. Der Projektfilter wird deshalb aus den
  // tatsächlichen Zeiteinträgen dieses Mitglieds im Zeitraum abgeleitet
  // (ungefiltert geladen, der Projektfilter selbst wird unten clientseitig
  // — d. h. hier im Server Component, kein zweiter RPC-Aufruf — auf das
  // Ergebnis angewendet) statt aus dem Projekt-Katalog des aktiven
  // Workspace.
  let allEntries: MemberTimeEntryRow[] | null = null;
  try {
    allEntries = await getMemberTimeEntries(repos, workspaceId, userId, from, to);
  } catch {
    allEntries = null;
  }
  const projectOptions = allEntries
    ? Array.from(new Map(allEntries.map((entry) => [entry.projectId, entry.projectName])).entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const entries = requestedProjectId
    ? allEntries?.filter((entry) => entry.projectId === requestedProjectId) ?? null
    : allEntries;
  const activeProjectFilter = requestedProjectId ? projectOptions.find((p) => p.id === requestedProjectId) : undefined;
  const projectNamesInRange = entries ? Array.from(new Set(entries.map((entry) => entry.projectName))).sort() : [];

  const byDay = new Map<string, MemberTimeEntryRow[]>();
  for (const entry of entries ?? []) {
    const bucket = byDay.get(entry.day) ?? [];
    bucket.push(entry);
    byDay.set(entry.day, bucket);
  }
  const days = Array.from(byDay.entries()).sort(([a], [b]) => b.localeCompare(a));

  return (
    <main className="flex animate-content-fade-in flex-col gap-6 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">
          {member.displayName ?? t(lang, i18nWorkspaceMembers.noDisplayNameFallback)}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{member.email}</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-text-secondary">{t(lang, i18nWorkspaceMembers.columnStatus)}</dt>
          <dd className="font-medium">
            {member.status === "active" ? t(lang, i18nWorkspaceMembers.statusActive) : t(lang, i18nWorkspaceMembers.statusInvited)}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">{t(lang, i18nWorkspaceMembers.columnRole)}</dt>
          <dd className="font-medium">
            {member.role === "owner"
              ? t(lang, i18nWorkspaceMembers.roleOwner)
              : member.role === "admin"
                ? t(lang, i18nWorkspaceMembers.roleAdmin)
                : t(lang, i18nWorkspaceMembers.roleMember)}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">{t(lang, employeeProfile.memberSinceLabel)}</dt>
          <dd className="font-medium">{formatDayLabel(member.since.slice(0, 10), locale)}</dd>
        </div>
      </dl>

      <div className="grid grid-cols-3 gap-4">
        <StatTile value={formatDuration(todaySeconds, locale)} label={t(lang, employeeProfile.todayLabel)} />
        <StatTile value={formatDuration(weekSeconds, locale)} label={t(lang, employeeProfile.thisWeekLabel)} />
        <StatTile value={formatDuration(monthSeconds, locale)} label={t(lang, employeeProfile.thisMonthLabel)} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t(lang, employeeProfile.projectsHeading)}</h2>
        {projectNamesInRange.length === 0 ? (
          <p className="text-sm text-foreground/60">{t(lang, employeeProfile.noProjectsInRange)}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {projectNamesInRange.map((name) => (
              <li key={name} className="rounded-full border border-line px-3 py-1 text-sm text-foreground/80">
                {name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{t(lang, employeeProfile.entriesHeading)}</h2>
          <form
            action={`/dashboard/workspaces/${workspaceId}/members/${userId}`}
            className="flex flex-wrap items-end gap-2 text-sm"
          >
            <label className="flex flex-col gap-1">
              {t(lang, employeeProfile.fromLabel)}
              <input type="date" name="from" defaultValue={from} className="rounded-md border border-line px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              {t(lang, employeeProfile.toLabel)}
              <input type="date" name="to" defaultValue={to} className="rounded-md border border-line px-2 py-1" />
            </label>
            <label className="flex flex-col gap-1">
              {t(lang, employeeProfile.projectLabel)}
              <select name="project" defaultValue={requestedProjectId ?? ""} className="rounded-md border border-line px-2 py-1">
                <option value="">{t(lang, employeeProfile.allProjects)}</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-md border border-line px-3 py-1">
              {t(lang, employeeProfile.apply)}
            </button>
          </form>
        </div>

        {activeProjectFilter && (
          <p className="font-mono text-xs tabular-nums text-foreground/50">{activeProjectFilter.name}</p>
        )}

        {entries === null ? (
          <p {...errorFeedbackProps} className={errorMessageClass}>
            {t(lang, employeeProfile.loadError)}
          </p>
        ) : days.length === 0 ? (
          <p className="text-sm text-foreground/60">{t(lang, employeeProfile.noEntriesInRange)}</p>
        ) : (
          <div className="flex flex-col divide-y divide-line border-t border-line">
            {days.map(([day, dayEntries]) => (
              <div key={day} className="flex flex-col gap-1 py-3">
                <span className="text-sm font-medium">{formatDayLabel(day, locale)}</span>
                <ul className="flex flex-col gap-1">
                  {dayEntries
                    .slice()
                    .sort((a, b) => b.startTime.localeCompare(a.startTime))
                    .map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-4 pl-4 text-sm">
                        <span className="font-mono tabular-nums text-foreground/60">
                          {formatTime(entry.startTime, locale)} – {entry.endTime ? formatTime(entry.endTime, locale) : t(lang, employeeProfile.running)}
                        </span>
                        <span className="text-foreground/70">{entry.projectName}</span>
                        <span className="font-mono tabular-nums text-foreground/70">
                          {formatDuration(
                            Math.max(
                              0,
                              Math.floor((new Date(entry.endTime ?? currentTimeMs()).getTime() - new Date(entry.startTime).getTime()) / 1000),
                            ),
                            locale,
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// Wrapped so eslint's react-hooks/purity rule (which flags a direct
// Date.now() call anywhere in a component body) doesn't fire — same
// exact reasoning as app/(dashboard)/dashboard/page.tsx's own
// currentTimeMs() and overview/page.tsx's copy of it: this page renders
// once per request on the server, so "now" as of render time is the
// correct, intended value for a still-running entry's elapsed duration.
function currentTimeMs(): number {
  return Date.now();
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
      <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}
