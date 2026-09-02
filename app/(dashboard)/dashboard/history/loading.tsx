import { SkeletonBlock, SkeletonHeading, SkeletonListRow, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Historie"
// (app/(dashboard)/dashboard/history/page.tsx) — mirrors its H1, the
// preset/date-range/project-filter toolbar row, and the flat divided list
// of day rows below.
export default function HistoryLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-6 py-8">
        <SkeletonHeading />

        <div className="flex flex-wrap items-center gap-3">
          <SkeletonBlock className="h-8 w-64 rounded-md" />
          <SkeletonBlock className="h-9 w-40 rounded-xl" />
          <SkeletonBlock className="h-9 w-48 rounded-xl" />
        </div>

        <SkeletonBlock className="h-3 w-48" />

        <div className="flex flex-col">
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </div>
      </main>
    </SkeletonScreen>
  );
}
