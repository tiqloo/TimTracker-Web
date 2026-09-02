import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Helpcenter"
// (app/(dashboard)/dashboard/support/helpcenter/page.tsx) — mirrors the
// back-link, H1 + intro line, and the FAQ <dl> (question/answer pairs,
// divided rows).
function FaqRow() {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-4 first:border-t">
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-3.5 w-5/6" />
    </div>
  );
}

export default function HelpcenterLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-6 py-8">
        <SkeletonBlock className="h-4 w-32" />
        <div className="flex flex-col gap-2">
          <SkeletonHeading />
          <SkeletonBlock className="h-4 w-72 max-w-full" />
        </div>

        <div className="flex flex-col">
          <FaqRow />
          <FaqRow />
          <FaqRow />
        </div>
      </main>
    </SkeletonScreen>
  );
}
