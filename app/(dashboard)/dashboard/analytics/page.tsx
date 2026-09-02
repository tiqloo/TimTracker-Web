import Link from "next/link";
import { headers } from "next/headers";
import { AccessGate } from "@/components/AccessGate";
import { HistoryChart } from "@/components/HistoryChart";
import { HistoryDateRangePicker } from "@/components/HistoryDateRangePicker";
import { HistoryProjectDistribution } from "@/components/HistoryProjectDistribution";
import { HistorySummaryCards } from "@/components/HistorySummaryCards";
import { HistoryWorkCalendar } from "@/components/HistoryWorkCalendar";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEntriesForRange, getHistory, isoToday } from "@/lib/application/dashboard";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { getRepositories } from "@/lib/application/server";
import { languageCodeToLocale } from "@/lib/domain/language";
import { canUseApp } from "@/lib/domain/subscription";
import { buildHistorySummary, buildProjectTimeTotals } from "@/lib/domain/history-insights";
import { addDaysIso, buildChartBars, formatDayLabel, resolveChartGranularity, resolveHistoryRange, startOfMonthIso, startOfWeekIso, startOfYearIso } from "@/lib/format";
import { history, t, type Translated } from "@/lib/i18n";

function currentTime(): Date { return new Date(); }

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; project?: string }> }) {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const locale = languageCodeToLocale(lang);
  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) return <AccessGate title={t(lang, history.analyticsTitle)} status={subscription.status} lang={lang} />;

  const today = isoToday();
  const params = await searchParams;
  const { from, to } = resolveHistoryRange(today, params);
  const allProjects = await repos.projects.getAll();
  const requestedProjectId = params.project?.trim();
  const activeProject = requestedProjectId ? allProjects.find((project) => project.id === requestedProjectId) : undefined;
  const projectId = activeProject?.id;
  const projectQuery = projectId ? `&project=${encodeURIComponent(projectId)}` : "";
  const [breakdowns, entries] = await Promise.all([getHistory(repos, from, to, projectId), getEntriesForRange(repos, from, to, projectId)]);
  const projectTotals = buildProjectTimeTotals(entries, allProjects, currentTime());
  const summary = buildHistorySummary(breakdowns, projectTotals);
  const granularity = resolveChartGranularity(from, to);
  const chartBars = buildChartBars(breakdowns, from, to, granularity);
  const presets: { label: Translated; from: string; to: string }[] = [
    { label: history.last30Days, from: addDaysIso(today, -29), to: today },
    { label: history.thisWeek, from: startOfWeekIso(today), to: today },
    { label: history.thisMonth, from: startOfMonthIso(today), to: today },
    { label: history.thisYear, from: startOfYearIso(today), to: today },
  ];
  const activeProjects = allProjects.filter((project) => !project.isArchived);

  return (
    <main className="flex animate-content-fade-in flex-col gap-6 py-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">Workspace</p>
        <h1 className="mt-2 text-[34px] font-semibold tracking-tight">{t(lang, history.analyticsTitle)}</h1>
        <p className="mt-2 text-sm text-text-secondary">{t(lang, history.analyticsDescription)}</p>
      </div>

      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-line/80 bg-surface/75 p-4">
        <nav className="flex flex-wrap gap-1">
          {presets.map((preset) => <Link key={preset.label.de} href={`/dashboard/analytics?from=${preset.from}&to=${preset.to}${projectQuery}`} className="rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-paper hover:text-foreground">{t(lang, preset.label)}</Link>)}
        </nav>
        <HistoryDateRangePicker from={from} to={to} projectId={projectId} lang={lang} locale={locale} basePath="/dashboard/analytics" />
        <form action="/dashboard/analytics" className="ml-auto flex items-end gap-2 text-sm">
          <input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} />
          <label className="flex flex-col gap-1">{t(lang, history.project)}<select name="project" defaultValue={projectId ?? ""} className="rounded-lg border border-line bg-surface px-3 py-2"><option value="">{t(lang, history.allProjects)}</option>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <button type="submit" className="rounded-lg border border-line bg-surface px-3 py-2">{t(lang, history.apply)}</button>
        </form>
      </section>

      <p className="font-mono text-xs tabular-nums text-foreground/50">{formatDayLabel(from, locale)} – {formatDayLabel(to, locale)}{activeProject && ` · ${activeProject.name}`}</p>
      <HistorySummaryCards summary={summary} locale={locale} lang={lang} />
      <HistoryWorkCalendar breakdowns={breakdowns} month={to.slice(0, 7)} locale={locale} lang={lang} />
      <HistoryChart bars={chartBars} granularity={granularity} lang={lang} activeProjectName={activeProject?.name} activeProjectColor={activeProject?.colorHex} />
      <HistoryProjectDistribution totals={projectTotals} locale={locale} lang={lang} />
    </main>
  );
}
