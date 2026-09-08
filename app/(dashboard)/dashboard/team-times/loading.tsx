import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 121's own AK-adjacent convention — same instant-feedback
// skeleton as every other app/(dashboard)/**/loading.tsx (Ticket 072).
function DayGroup() {
  return (
    <div className="flex flex-col gap-2 border-b border-line/60 py-3 last:border-0">
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="ml-4 h-3 w-64" />
      <SkeletonBlock className="ml-4 h-3 w-56" />
    </div>
  );
}

export default function TeamTimesLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-6 py-8">
        <SkeletonHeading />
        <div className="flex flex-col">
          <DayGroup />
          <DayGroup />
          <DayGroup />
        </div>
      </main>
    </SkeletonScreen>
  );
}
