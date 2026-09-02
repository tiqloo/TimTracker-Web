import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Auswertung"
// (app/(dashboard)/dashboard/analytics/page.tsx) — mirrors the eyebrow +
// H1 + description, the filter toolbar card, HistorySummaryCards' 3-column
// grid, and the calendar/chart/distribution blocks stacked below (see
// components/HistoryWorkCalendar.tsx, HistoryChart.tsx,
// HistoryProjectDistribution.tsx).
export default function AnalyticsLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-6 py-8">
        <div className="flex flex-col gap-3">
          <SkeletonHeading eyebrow />
          <SkeletonBlock className="h-4 w-96 max-w-full" />
        </div>

        <div className="rounded-2xl border border-line/80 bg-surface/75 p-4">
          <SkeletonBlock className="h-9 w-full max-w-xl rounded-xl" />
        </div>

        <SkeletonBlock className="h-3 w-48" />

        <div className="grid gap-3 sm:grid-cols-3">
          <SkeletonBlock className="h-24 rounded-2xl" />
          <SkeletonBlock className="h-24 rounded-2xl" />
          <SkeletonBlock className="h-24 rounded-2xl" />
        </div>

        <SkeletonBlock className="h-64 rounded-2xl" />
        <SkeletonBlock className="h-56 rounded-2xl" />
        <SkeletonBlock className="h-40 rounded-2xl" />
      </main>
    </SkeletonScreen>
  );
}
