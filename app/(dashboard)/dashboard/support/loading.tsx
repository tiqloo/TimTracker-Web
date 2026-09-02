import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Support"
// (app/(dashboard)/dashboard/support/page.tsx -> SupportClient). Mirrors
// the greeting H1, the request-form card (`rounded-xl border border-line
// bg-surface p-5`), the quick-links row, and the footer links.
export default function SupportLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-10 py-8">
        <SkeletonHeading />

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-10 w-full rounded-md" />
          <SkeletonBlock className="h-24 w-full rounded-md" />
          <SkeletonBlock className="h-9 w-32 rounded-md" />
        </div>

        <div className="flex flex-col gap-3">
          <SkeletonBlock className="h-4 w-36" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SkeletonBlock className="h-16 rounded-xl" />
            <SkeletonBlock className="h-16 rounded-xl" />
          </div>
        </div>

        <div className="flex gap-4 border-t border-line pt-4">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
      </main>
    </SkeletonScreen>
  );
}
