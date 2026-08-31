// Shared day-detail rendering — the three summary tiles + flat chronological
// entry list. Used by both app/(dashboard)/page.tsx ("Heute") and
// app/(dashboard)/history/[day]/page.tsx (an arbitrary past day): the spec
// (Ticket 001/003 in TimTracker-Starter, Ticket 018 itself) says a past day
// should render in the SAME layout as "Heute", not a separate design.
// Deliberately a plain presentational component — it takes already-fetched
// data, not a Repositories instance, so it stays usable from any Server
// Component regardless of which application function fetched the data
// (getTodayBreakdown/getTodayEntries vs. getBreakdownForDay/getEntriesForDay).
import { formatDuration, formatTime } from "@/lib/format";
import type { DailyBreakdown, TimeEntry } from "@/lib/domain/time-entry";
import { dayDetail, t, type Lang } from "@/lib/i18n";

export function DayDetail({
  breakdown,
  entries,
  nowMs,
  emptyMessage,
  lang,
}: {
  breakdown: DailyBreakdown;
  entries: TimeEntry[];
  nowMs: number;
  emptyMessage: string;
  lang: Lang;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile
          label={t(lang, dayDetail.totalAutomaticTime)}
          value={formatDuration(breakdown.totalSeconds)}
        />
        <SummaryTile
          label={t(lang, dayDetail.projectTime)}
          value={formatDuration(breakdown.projectSeconds)}
        />
        <SummaryTile
          label={t(lang, dayDetail.unassignedTime)}
          value={formatDuration(breakdown.unassignedSeconds)}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground/70">{t(lang, dayDetail.entries)}</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-foreground/60">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {entries.map((entry) => {
              const startMs = new Date(entry.startTime).getTime();
              const endMs = entry.endTime ? new Date(entry.endTime).getTime() : nowMs;
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <span className="font-mono tabular-nums">
                    {formatTime(entry.startTime)} –{" "}
                    {entry.endTime ? formatTime(entry.endTime) : t(lang, dayDetail.running)}
                  </span>
                  <span className="font-mono tabular-nums text-foreground/70">
                    {formatDuration((endMs - startMs) / 1000)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-xs text-foreground/60">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
