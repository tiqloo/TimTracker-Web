import Link from "next/link";
import { getRepositories } from "@/lib/application/server";
import { getHistory, isoToday } from "@/lib/application/dashboard";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import {
  addDaysIso,
  formatDayLabel,
  formatDuration,
  resolveHistoryRange,
  startOfMonthIso,
  startOfWeekIso,
} from "@/lib/format";

// "Historie" — flat list of past days for a selectable period, plus CSV
// export of the same period. Mirrors HistoryLogView.swift: flat rows, no
// calendar widget, no nested grouping. Period selection is deliberately
// plain GET links/a native <form> (no client-side date-picker component)
// per Ticket 018 — "keep it simple" beats a fancy half-finished picker.
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const repos = await getRepositories();

  // Same access gate as "Heute" (app/(dashboard)/page.tsx) — reused
  // verbatim, not reimplemented.
  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return (
      <main className="p-8">
        <h1 className="mb-2 text-xl font-semibold">Historie</h1>
        <p className="text-sm text-black/70 dark:text-white/70">
          Kein aktiver Testzeitraum oder Abo mehr
          {subscription.status !== "none" ? ` (Status: ${subscription.status})` : ""}.
          Bitte Abo verwalten, um wieder auf deine Daten zuzugreifen.
        </p>
      </main>
    );
  }

  const today = isoToday();
  const params = await searchParams;
  const { from, to } = resolveHistoryRange(today, params);

  const days = (await getHistory(repos, from, to)).slice().sort((a, b) =>
    b.day.localeCompare(a.day),
  );

  const presets = [
    { label: "Letzte 30 Tage", from: addDaysIso(today, -29), to: today },
    { label: "Diese Woche", from: startOfWeekIso(today), to: today },
    { label: "Dieser Monat", from: startOfMonthIso(today), to: today },
  ];

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Historie</h1>

      <div className="flex flex-wrap items-center gap-4">
        <nav className="flex flex-wrap gap-3">
          {presets.map((preset) => (
            <Link
              key={preset.label}
              href={`/history?from=${preset.from}&to=${preset.to}`}
              className="text-sm underline"
            >
              {preset.label}
            </Link>
          ))}
        </nav>

        <form action="/history" className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Von
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded border border-black/15 px-2 py-1 dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1">
            Bis
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded border border-black/15 px-2 py-1 dark:border-white/20"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-black/15 px-3 py-1 dark:border-white/20"
          >
            Anwenden
          </button>
        </form>

        <a href={`/history/export?from=${from}&to=${to}`} className="text-sm underline">
          Als CSV exportieren
        </a>
      </div>

      <p className="text-sm text-black/60 dark:text-white/60">
        {formatDayLabel(from)} – {formatDayLabel(to)}
      </p>

      {days.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Keine Aktivität in diesem Zeitraum.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
          {days.map((day) => (
            <li key={day.day}>
              <Link
                href={`/history/${day.day}`}
                className="flex items-center justify-between gap-4 py-3 text-sm hover:underline"
              >
                <span className="w-36 shrink-0">{formatDayLabel(day.day)}</span>
                <span className="flex flex-1 justify-end gap-6 tabular-nums text-black/70 dark:text-white/70">
                  <DayValue label="Automatik" seconds={day.standardSeconds} />
                  <DayValue label="Projekt" seconds={day.projectSeconds} />
                  <DayValue label="Nicht zugeordnet" seconds={day.unassignedSeconds} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function DayValue({ label, seconds }: { label: string; seconds: number }) {
  return (
    <span className="flex w-28 flex-col items-end">
      <span className="text-xs text-black/50 dark:text-white/50">{label}</span>
      <span>{formatDuration(seconds)}</span>
    </span>
  );
}
