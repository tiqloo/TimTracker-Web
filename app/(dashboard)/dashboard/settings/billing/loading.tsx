import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Abo verwalten"
// (app/(dashboard)/dashboard/settings/billing/page.tsx) — mirrors its H1,
// the status card (`rounded-xl border border-line bg-surface p-5`), the
// manage-subscription button, and the back-to-settings link.
export default function BillingLoading() {
  return (
    <SkeletonScreen>
      <main className="flex max-w-3xl flex-col gap-7 py-8 sm:py-10">
        <SkeletonBlock className="h-8 w-48 rounded-md" />
        <SkeletonHeading />
        <SkeletonBlock className="-mt-4 h-4 w-full max-w-xl" />

        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex justify-between gap-4">
              <div className="flex flex-col gap-2">
                <SkeletonBlock className="h-5 w-32" />
                <SkeletonBlock className="h-4 w-64" />
              </div>
              <SkeletonBlock className="h-8 w-24 rounded-full" />
            </div>
            <SkeletonBlock className="h-24 w-full rounded-xl sm:w-1/2" />
          </div>
          <div className="flex flex-col gap-5 border-t border-line bg-background/70 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex flex-col gap-2">
              <SkeletonBlock className="h-4 w-48" />
              <SkeletonBlock className="h-4 w-72" />
              <SkeletonBlock className="h-3 w-56" />
            </div>
            <SkeletonBlock className="h-10 w-64 rounded-md" />
          </div>
        </div>
      </main>
    </SkeletonScreen>
  );
}
