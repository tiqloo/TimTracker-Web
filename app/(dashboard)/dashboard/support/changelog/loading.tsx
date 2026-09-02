import { SkeletonBlock, SkeletonHeading, SkeletonListRow, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Produkt-Neuerungen"
// (app/(dashboard)/dashboard/support/changelog/page.tsx) — mirrors the
// back-link, H1, and the flat divided list of changelog entries.
export default function ChangelogLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-6 py-8">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonHeading />

        <div className="flex flex-col">
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </div>
      </main>
    </SkeletonScreen>
  );
}
