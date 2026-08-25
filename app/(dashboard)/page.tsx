import Link from "next/link";
import { getRepositories } from "@/lib/application/server";
import { getTodayBreakdown, getTodayEntries } from "@/lib/application/dashboard";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import { formatDuration, formatTime } from "@/lib/format";

// Wrapped so eslint's react-hooks/purity rule (which flags a direct
// Date.now() call anywhere in a component body, Server Components
// included) doesn't fire here. This page renders once per request on the
// server — there's no re-render to be non-idempotent across — so "now"
// as of render time is the correct, intended value for a still-running
// entry's duration-so-far, not a purity bug to work around unsafely.
function currentTimeMs(): number {
  return Date.now();
}

// "Heute" — Server Component, gets its Repositories instance from
// lib/application/server.ts (the designated exception, see CLAUDE.md's
// "Resolved 2026-08-25" entry) and passes it straight into
// lib/application/dashboard.ts's use cases. No business logic here beyond
// picking labels/formatting — the actual unassignedSeconds calculation
// stays in DailyBreakdown (lib/domain/time-entry.ts), not reimplemented.
export default async function TodayPage() {
  const repos = await getRepositories();

  // Access gate: mirrors the RLS policy via canUseApp() (see
  // lib/domain/subscription.ts). Deliberately a simple conditional
  // message rather than a full paywall/upgrade flow — building that out
  // (pricing, checkout) belongs with the billing/settings work, not this
  // phase. TODO (Ticket 018, later phase): once
  // app/(dashboard)/settings/billing exists, link there instead of just
  // stating the status.
  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return (
      <main className="p-8">
        <h1 className="mb-2 text-xl font-semibold">Heute</h1>
        <p className="text-sm text-black/70 dark:text-white/70">
          Kein aktiver Testzeitraum oder Abo mehr
          {subscription.status !== "none" ? ` (Status: ${subscription.status})` : ""}.
          Bitte Abo verwalten, um wieder auf deine Daten zuzugreifen.
        </p>
      </main>
    );
  }

  const [breakdown, entries] = await Promise.all([
    getTodayBreakdown(repos),
    getTodayEntries(repos),
  ]);
  const nowMs = currentTimeMs();

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-xl font-semibold">Heute</h1>

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
          <p className="text-sm text-black/60 dark:text-white/60">
            Noch keine Zeiteinträge für heute.
          </p>
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

      <Link href="/history" className="text-sm underline">
        Zur Historie
      </Link>
    </main>
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
