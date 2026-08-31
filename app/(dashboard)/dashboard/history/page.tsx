import Link from "next/link";
import { getRepositories } from "@/lib/application/server";
import { getHistory, isoToday } from "@/lib/application/dashboard";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import {
  addDaysIso,
  buildChartBars,
  formatDayLabel,
  formatDuration,
  resolveChartGranularity,
  resolveHistoryRange,
  startOfMonthIso,
  startOfWeekIso,
  startOfYearIso,
} from "@/lib/format";
import { HistoryChart } from "@/components/HistoryChart";
import { AccessGate } from "@/components/AccessGate";

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
    return <AccessGate title="Historie" status={subscription.status} />;
  }

  const today = isoToday();
  const params = await searchParams;
  const { from, to } = resolveHistoryRange(today, params);

  const breakdowns = await getHistory(repos, from, to);
  const days = breakdowns.slice().sort((a, b) => b.day.localeCompare(a.day));

  // Chart granularity adapts to the selected range's length, not to which
  // preset was clicked — so a hand-picked long custom range also falls
  // back to monthly bars, not just the "Dieses Jahr" preset specifically.
  // See lib/format.ts#resolveChartGranularity for the exact threshold and
  // reasoning.
  const granularity = resolveChartGranularity(from, to);
  const chartBars = buildChartBars(breakdowns, from, to, granularity);

  const presets = [
    { label: "Letzte 30 Tage", from: addDaysIso(today, -29), to: today },
    { label: "Diese Woche", from: startOfWeekIso(today), to: today },
    { label: "Dieser Monat", from: startOfMonthIso(today), to: today },
    { label: "Dieses Jahr", from: startOfYearIso(today), to: today },
  ];

  return (
    <main className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Historie</h1>

      <div className="flex flex-wrap items-center gap-4">
        <nav className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <Link
              key={preset.label}
              href={`/dashboard/history?from=${preset.from}&to=${preset.to}`}
              className="rounded-md px-2.5 py-1 text-sm text-foreground/70 hover:text-foreground"
            >
              {preset.label}
            </Link>
          ))}
        </nav>

        <form action="/dashboard/history" className="flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Von
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-md border border-line px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            Bis
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-md border border-line px-2 py-1"
            />
          </label>
          <button type="submit" className="rounded-md border border-line px-3 py-1">
            Anwenden
          </button>
        </form>

        <a
          href={`/dashboard/history/export?from=${from}&to=${to}`}
          className="text-sm text-foreground/70 hover:text-foreground"
        >
          Als CSV exportieren
        </a>
      </div>

      <p>
        <span className="font-mono text-xs tabular-nums text-foreground/50">
          {formatDayLabel(from)} – {formatDayLabel(to)}
        </span>
      </p>

      <HistoryChart bars={chartBars} granularity={granularity} />

      {days.length === 0 ? (
        <p className="text-sm text-foreground/60">Keine Aktivität in diesem Zeitraum.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-t border-line">
          {days.map((day) => (
            <li key={day.day}>
              <Link
                href={`/dashboard/history/${day.day}`}
                className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-paper"
              >
                <span className="w-36 shrink-0">{formatDayLabel(day.day)}</span>
                <span className="flex flex-1 justify-end gap-6 font-mono tabular-nums text-foreground/70">
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
      <span className="font-sans text-xs text-foreground/50">{label}</span>
      <span>{formatDuration(seconds)}</span>
    </span>
  );
}
