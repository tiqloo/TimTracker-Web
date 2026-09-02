import Link from "next/link";
import type { DailyBreakdown } from "@/lib/domain/time-entry";
import { addDaysIso, formatDuration } from "@/lib/format";
import { history, historyWeekdayAbbreviations, t, type Lang } from "@/lib/i18n";

export function HistoryWorkCalendar({ breakdowns, month, locale, lang }: { breakdowns: DailyBreakdown[]; month: string; locale: string; lang: Lang }) {
  const firstDay = `${month}-01`;
  const nextMonth = month.endsWith("-12")
    ? `${Number(month.slice(0, 4)) + 1}-01-01`
    : `${month.slice(0, 5)}${String(Number(month.slice(5, 7)) + 1).padStart(2, "0")}-01`;
  const lastDay = addDaysIso(nextMonth, -1);
  const byDay = new Map(breakdowns.map((day) => [day.day, day]));
  const maxSeconds = Math.max(1, ...breakdowns.map((day) => day.totalSeconds));
  const mondayOffset = (new Date(`${firstDay}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekdays = historyWeekdayAbbreviations[lang];
  const monthLabel = new Date(`${firstDay}T00:00:00Z`).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const days: string[] = [];
  for (let day = firstDay; day <= lastDay; day = addDaysIso(day, 1)) days.push(day);

  return (
    <section className="rounded-2xl border border-line/80 bg-surface/90 p-5 shadow-[0_12px_35px_rgba(22,28,45,0.04)] sm:p-6" aria-labelledby="work-calendar-title">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 id="work-calendar-title" className="text-lg font-semibold">{t(lang, history.calendarView)}</h2>
        <span className="text-sm capitalize text-text-secondary">{monthLabel}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekdays.map((weekday) => <span key={weekday} className="pb-1 text-center text-[10px] font-semibold tracking-wide text-text-secondary uppercase">{weekday}</span>)}
        {Array.from({ length: mondayOffset }, (_, index) => <span key={`empty-${index}`} />)}
        {days.map((day) => {
          const seconds = byDay.get(day)?.totalSeconds ?? 0;
          const intensity = seconds === 0 ? 0.06 : 0.18 + (seconds / maxSeconds) * 0.7;
          return (
            <Link key={day} href={`/dashboard/history/${day}`} title={`${day}: ${formatDuration(seconds, locale)}`} className="group flex min-h-14 flex-col justify-between rounded-xl border border-brand/5 p-2 transition-transform hover:-translate-y-0.5 sm:min-h-16" style={{ backgroundColor: `color-mix(in srgb, var(--brand) ${Math.round(intensity * 100)}%, var(--surface))` }}>
              <span className="text-xs font-semibold group-hover:text-brand">{Number(day.slice(8, 10))}</span>
              <span className="hidden font-mono text-[9px] tabular-nums text-foreground/60 sm:block">{formatDuration(seconds, locale)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
