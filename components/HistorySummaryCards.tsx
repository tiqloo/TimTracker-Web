import type { HistorySummary } from "@/lib/domain/history-insights";
import { formatDuration } from "@/lib/format";
import { history, t, type Lang } from "@/lib/i18n";

export function HistorySummaryCards({ summary, locale, lang }: { summary: HistorySummary; locale: string; lang: Lang }) {
  return (
    <section aria-labelledby="history-summary-title">
      <h2 id="history-summary-title" className="mb-3 text-lg font-semibold">
        {t(lang, history.periodOverview)}
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label={t(lang, history.totalHours)} value={formatDuration(summary.totalSeconds, locale)} />
        <SummaryCard label={t(lang, history.averagePerDay)} value={formatDuration(summary.averageSecondsPerActiveDay, locale)} />
        <SummaryCard label={t(lang, history.projectCount)} value={String(summary.projectCount)} />
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-surface/90 p-5 shadow-[0_12px_35px_rgba(22,28,45,0.04)]">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
