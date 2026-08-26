import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepositories } from "@/lib/application/server";
import { getBreakdownForDay, getEntriesForDay } from "@/lib/application/dashboard";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import { formatDayLabel } from "@/lib/format";
import { DayDetail } from "@/components/DayDetail";

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Same purity-rule workaround as app/(dashboard)/page.tsx's currentTimeMs()
// — a named wrapper outside the component body instead of a direct
// Date.now() call inside it. A past day's entries are never actually
// still running in practice, but the shared DayDetail component still
// needs a "now" reference for the (defensive) case where one is.
function currentTimeMs(): number {
  return Date.now();
}

// Arbitrary past-day detail — renders in the exact same layout as "Heute"
// (app/(dashboard)/page.tsx), per Ticket 001/003 and Ticket 018: a past
// day is not a separate design, just the same DayDetail component fed
// with that day's data instead of today's.
export default async function HistoryDayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day } = await params;
  if (!ISO_DAY_RE.test(day)) notFound();

  const repos = await getRepositories();

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return (
      <main className="p-8">
        <h1 className="mb-2 text-xl font-semibold">{formatDayLabel(day)}</h1>
        <p className="text-sm text-black/70 dark:text-white/70">
          Kein aktiver Testzeitraum oder Abo mehr
          {subscription.status !== "none" ? ` (Status: ${subscription.status})` : ""}.
          Bitte Abo verwalten, um wieder auf deine Daten zuzugreifen.
        </p>
      </main>
    );
  }

  const [breakdown, entries] = await Promise.all([
    getBreakdownForDay(repos, day),
    getEntriesForDay(repos, day),
  ]);
  const nowMs = currentTimeMs();

  return (
    <main className="flex flex-col gap-8 p-8">
      <div>
        <Link href="/dashboard/history" className="text-sm underline">
          Zurück zur Historie
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{formatDayLabel(day)}</h1>
      </div>

      <DayDetail
        breakdown={breakdown}
        entries={entries}
        nowMs={nowMs}
        emptyMessage="Keine Zeiteinträge für diesen Tag."
      />
    </main>
  );
}
