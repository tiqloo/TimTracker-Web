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

export function DayDetail({
  breakdown,
  entries,
  nowMs,
  emptyMessage,
}: {
  breakdown: DailyBreakdown;
  entries: TimeEntry[];
  nowMs: number;
  emptyMessage: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile
          label="Automatikzeit gesamt"
          value={formatDuration(breakdown.totalSeconds)}
        />
        <SummaryTile
          label="Projektzeit"
          value={formatDuration(breakdown.projectSeconds)}
        />
        <SummaryTile
          label="Nicht zugeordnete Zeit"
          value={formatDuration(breakdown.unassignedSeconds)}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black/70 dark:text-white/70">
          Einträge
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
            {entries.map((entry) => {
              const startMs = new Date(entry.startTime).getTime();
              const endMs = entry.endTime ? new Date(entry.endTime).getTime() : nowMs;
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <span className="tabular-nums">
                    {formatTime(entry.startTime)} –{" "}
                    {entry.endTime ? formatTime(entry.endTime) : "läuft"}
                  </span>
                  <span className="tabular-nums text-black/70 dark:text-white/70">
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
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <p className="text-xs text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
