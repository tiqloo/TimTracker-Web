import { SkeletonBlock, SkeletonCard, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Einstellungen"
// (app/(dashboard)/dashboard/settings/page.tsx). SettingsClient renders
// several independent rounded-2xl section cards (design/theme, profile,
// subscription overview, language, danger zone — see that file's own
// `<section className="rounded-2xl border border-line/90 bg-surface ...">`
// blocks); mirrored here as a simple 2-column grid of generic card
// placeholders rather than trying to reproduce every section's exact
// internals.
function SettingsSectionSkeleton({ className = "" }: { className?: string }) {
  return (
    <SkeletonCard className={`flex flex-col gap-4 p-6 ${className}`}>
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="h-10 w-full rounded-xl" />
      <SkeletonBlock className="h-10 w-2/3 rounded-xl" />
    </SkeletonCard>
  );
}

export default function SettingsLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-7 py-8 sm:py-10">
        <div className="flex flex-col gap-3">
          <SkeletonHeading />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsSectionSkeleton />
          <SettingsSectionSkeleton />
          <SettingsSectionSkeleton className="lg:col-span-2" />
        </div>
      </main>
    </SkeletonScreen>
  );
}
