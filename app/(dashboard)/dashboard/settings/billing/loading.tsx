import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Abo verwalten"
// (app/(dashboard)/dashboard/settings/billing/page.tsx) — mirrors its H1,
// the status card (`rounded-xl border border-line bg-surface p-5`), the
// manage-subscription button, and the back-to-settings link.
export default function BillingLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-8 py-8">
        <SkeletonHeading />

        <div className="flex max-w-md flex-col gap-3 rounded-xl border border-line bg-surface p-5">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-4 w-56" />
          <SkeletonBlock className="h-4 w-48" />
        </div>

        <SkeletonBlock className="h-10 w-48 rounded-xl" />
        <SkeletonBlock className="h-4 w-32" />
      </main>
    </SkeletonScreen>
  );
}
