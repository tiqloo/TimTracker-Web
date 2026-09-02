import { SkeletonBlock, SkeletonCard, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Heute" (app/(dashboard)/
// dashboard/page.tsx), shown the moment a nav click starts this route's
// navigation. Mirrors that page's real layout: eyebrow + H1, then one
// rounded-2xl card holding DayDetail's actual shape — a big mono hero
// number, two secondary stat pills, a horizontal timeline bar, then a
// divided list of entry rows (see components/DayDetail.tsx).
export default function TodayLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-6 py-8 sm:py-10">
        <SkeletonHeading eyebrow />

        <SkeletonCard className="flex flex-col gap-6">
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
        </SkeletonCard>

        <SkeletonBlock className="h-4 w-32" />
      </main>
    </SkeletonScreen>
  );
}
