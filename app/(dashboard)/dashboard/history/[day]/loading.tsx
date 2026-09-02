import { SkeletonBlock, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for a single day's detail
// (app/(dashboard)/dashboard/history/[day]/page.tsx). Mirrors that page's
// back-link + H1, then DayDetail's shape directly (no rounded-2xl card
// wrapper here — unlike "Heute", this page renders <DayDetail /> without
// one, see components/DayDetail.tsx).
export default function HistoryDayLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-8 py-8">
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-9 w-48" />
        </div>

        <div className="flex flex-col gap-2">
          <SkeletonBlock className="h-3 w-40" />
          <SkeletonBlock className="h-12 w-48 sm:h-14" />
          <div className="mt-1 flex gap-5">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-28" />
          </div>
        </div>

        <SkeletonBlock className="h-8 rounded-lg" />

        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-5 w-2/3" />
          <SkeletonBlock className="h-5 w-1/2" />
          <SkeletonBlock className="h-5 w-3/5" />
        </div>
      </main>
    </SkeletonScreen>
  );
}
