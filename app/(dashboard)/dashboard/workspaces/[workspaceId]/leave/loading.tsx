import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Same instant-feedback skeleton convention as every other
// app/(dashboard)/**/loading.tsx (Ticket 072).
export default function LeaveWorkspaceLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-6 py-8">
        <SkeletonHeading />
        <SkeletonBlock className="h-24 w-full max-w-xl rounded-xl" />
      </main>
    </SkeletonScreen>
  );
}
