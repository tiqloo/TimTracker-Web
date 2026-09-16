import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 193 — same instant-feedback skeleton convention as every other
// app/(dashboard)/**/loading.tsx (Ticket 072/184).
export default function CompanyAnalyticsLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-6 py-8">
        <SkeletonHeading />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-24 w-full" />
      </main>
    </SkeletonScreen>
  );
}
