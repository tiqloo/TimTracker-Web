import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getHistory, isoToday } from "@/lib/application/dashboard";
import { getActiveWorkspaceTimeZone } from "@/lib/application/workspace";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { languageCodeToLocale } from "@/lib/domain/language";
import { canUseApp } from "@/lib/domain/subscription";
import {
  addDaysIso,
  formatDayLabel,
  formatDuration,
  resolveHistoryRange,
  startOfMonthIso,
  startOfWeekIso,
  startOfYearIso,
} from "@/lib/format";
import { HistoryDateRangePicker } from "@/components/HistoryDateRangePicker";
import { AccessGate } from "@/components/AccessGate";
import { history, projects as projectsI18n, t, type Translated } from "@/lib/i18n";

// "Historie" — flat list of past days for a selectable period, plus
// CSV/PDF export of the same period. Mirrors HistoryLogView.swift: flat
// rows, no nested grouping. Period selection used to be plain GET links/a
// native <form> only (no client-side date-picker) per Ticket 018 — "keep
// it simple" beats a fancy half-finished picker — Ticket 043 keeps that
// spirit for the four presets (still plain <Link>s, zero JS) but adds a
// real calendar-grid picker (components/HistoryDateRangePicker.tsx) for
// the free/custom range, plus a project filter that narrows both the day
// list and the chart. See that component's own header comment for why a
// hand-rolled grid instead of a dependency, and this file's projectQuery
// helper below for how the filter is threaded through every link/form/
// export URL on this page.
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; project?: string }>;
}) {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const locale = languageCodeToLocale(lang);

  // Same access gate as "Heute" (app/(dashboard)/page.tsx) — reused
  // verbatim, not reimplemented.
  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return <AccessGate title={t(lang, history.pageTitle)} status={subscription.status} lang={lang} />;
  }

  const timeZone = await getActiveWorkspaceTimeZone(repos);
  const today = isoToday(new Date(), timeZone);
  const params = await searchParams;
  const { from, to } = resolveHistoryRange(today, params);

  // Ticket 043 project filter. Validated against the real project list
  // (repos.projects.getAll() — every real, non-system project, archived
  // included per Ticket 001's "archiving isn't deletion" rule, see that
  // repository's own comment) rather than trusted as-is: a stale or
  // tampered `project` query param falls back to "all projects" instead
  // of silently producing a confusing "filtered to nothing" page.
  const allProjects = await repos.projects.getAll();
  const requestedProjectId = params.project?.trim() || undefined;
  const activeProject = requestedProjectId
    ? allProjects.find((project) => project.id === requestedProjectId)
    : undefined;
  const projectId = activeProject?.id;
  // Appended to every preset link / export link below so switching a
  // preset or exporting never silently drops the active project filter.
  const projectQuery = projectId ? `&project=${encodeURIComponent(projectId)}` : "";

  const breakdowns = await getHistory(repos, from, to, projectId);
  const days = breakdowns.slice().sort((a, b) => b.day.localeCompare(a.day));

  const presets: { label: Translated; from: string; to: string }[] = [
    { label: history.last30Days, from: addDaysIso(today, -29), to: today },
    { label: history.thisWeek, from: startOfWeekIso(today), to: today },
    { label: history.thisMonth, from: startOfMonthIso(today), to: today },
    { label: history.thisYear, from: startOfYearIso(today), to: today },
  ];

  const activeProjects = allProjects.filter((project) => !project.isArchived);
  const archivedProjects = allProjects.filter((project) => project.isArchived);

  return (
    <main className="flex animate-content-fade-in flex-col gap-6 py-8">
      <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, history.pageTitle)}</h1>

      <div className="flex flex-wrap items-center gap-4">
        <nav className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <Link
              key={preset.label.de}
              href={`/dashboard/history?from=${preset.from}&to=${preset.to}${projectQuery}`}
              className="rounded-md px-2.5 py-1 text-sm text-foreground/70 hover:text-foreground"
            >
              {t(lang, preset.label)}
            </Link>
          ))}
        </nav>

        <HistoryDateRangePicker from={from} to={to} projectId={projectId} lang={lang} locale={locale} />

        {/* Plain GET <form> (no JS needed) — the project filter's own
            fallback, independent of the calendar picker above. `from`/`to`
            travel along as hidden fields so changing just the project
            filter never resets the currently selected period. */}
        <form action="/dashboard/history" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <label className="flex flex-col gap-1">
            {t(lang, history.project)}
            <select
              name="project"
              defaultValue={projectId ?? ""}
              className="rounded-md border border-line px-2 py-1"
            >
              <option value="">{t(lang, history.allProjects)}</option>
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
            {t(lang, history.apply)}
          </button>
        </form>

        <a
          href={`/dashboard/history/export?from=${from}&to=${to}${projectQuery}`}
          className="text-sm text-foreground/70 hover:text-foreground"
        >
          {t(lang, history.exportCsv)}
        </a>
        <a
          href={`/dashboard/history/export/pdf?from=${from}&to=${to}${projectQuery}`}
          className="text-sm text-foreground/70 hover:text-foreground"
        >
          {t(lang, history.exportPdf)}
        </a>
      </div>

      <p>
        <span className="font-mono text-xs tabular-nums text-foreground/50">
          {formatDayLabel(from, locale)} – {formatDayLabel(to, locale)}
          {activeProject && ` · ${activeProject.name}`}
        </span>
      </p>

      {days.length === 0 ? (
        <p className="text-sm text-foreground/60">
          {t(lang, projectId ? history.noActivityFiltered : history.noActivity)}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-t border-line">
          {days.map((day) => (
            <li key={day.day}>
              <Link
                href={`/dashboard/history/${day.day}`}
                className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-paper"
              >
                <span className="w-36 shrink-0">{formatDayLabel(day.day, locale)}</span>
                <span className="flex flex-1 justify-end gap-6 font-mono tabular-nums text-foreground/70">
                  <DayValue label={t(lang, history.automatic)} seconds={day.standardSeconds} locale={locale} />
                  <DayValue label={t(lang, history.project)} seconds={day.projectSeconds} locale={locale} />
                  <DayValue label={t(lang, history.unassigned)} seconds={day.unassignedSeconds} locale={locale} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function DayValue({
  label,
  seconds,
  locale,
}: {
  label: string;
  seconds: number;
  locale: string;
}) {
  return (
    <span className="flex w-28 flex-col items-end">
      <span className="font-sans text-xs text-foreground/50">{label}</span>
      <span>{formatDuration(seconds, locale)}</span>
    </span>
  );
}
