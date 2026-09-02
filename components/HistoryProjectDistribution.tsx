import type { ProjectTimeTotal } from "@/lib/domain/history-insights";
import { formatDuration } from "@/lib/format";
import { history, t, type Lang } from "@/lib/i18n";

export function HistoryProjectDistribution({ totals, locale, lang }: { totals: ProjectTimeTotal[]; locale: string; lang: Lang }) {
  if (totals.length === 0) return null;
  const totalSeconds = totals.reduce((sum, project) => sum + project.seconds, 0);
  const stops = totals.map((project, index) => {
    const start = totals.slice(0, index).reduce((sum, preceding) => sum + preceding.percentage * 100, 0);
    return `#${project.colorHex} ${start}% ${start + project.percentage * 100}%`;
  }).join(", ");

  return (
    <section className="rounded-2xl border border-line/80 bg-surface/90 p-5 shadow-[0_12px_35px_rgba(22,28,45,0.04)] sm:p-6" aria-labelledby="project-distribution-title">
      <h2 id="project-distribution-title" className="mb-5 text-lg font-semibold">{t(lang, history.projectOverview)}</h2>
      <div className="grid items-center gap-7 sm:grid-cols-[180px_1fr]">
        <div className="relative mx-auto h-40 w-40 rounded-full" style={{ background: `conic-gradient(${stops})` }}>
          <div className="absolute inset-8 grid place-items-center rounded-full bg-surface text-center">
            <span><span className="block text-xs text-text-secondary">{t(lang, history.totalHours)}</span><span className="mt-1 block font-mono text-sm font-semibold tabular-nums">{formatDuration(totalSeconds, locale)}</span></span>
          </div>
        </div>
        <ul className="grid gap-2.5">
          {totals.map((project) => (
            <li key={project.id} className="flex items-center gap-3 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `#${project.colorHex}` }} />
              <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
              <span className="font-mono tabular-nums text-text-secondary">{formatDuration(project.seconds, locale)}</span>
              <span className="w-11 text-right font-mono text-xs tabular-nums text-text-secondary">{Math.round(project.percentage * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
