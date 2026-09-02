import { SkeletonBlock, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Erste Schritte"
// (app/(dashboard)/dashboard/get-started/page.tsx) — mirrors the eyebrow +
// H1 + intro paragraph, the progress-bar card, the 4 onboarding Step cards
// (icon + title + body + status pill, see that page's own Step()
// component), and the "open Today" link at the bottom.
function StepSkeleton() {
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-line/90 bg-surface p-5 shadow-[0_16px_46px_-38px_rgba(24,24,23,0.45)] sm:p-6">
      <SkeletonBlock className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="flex flex-1 flex-col gap-2">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-3.5 w-full max-w-sm" />
      </div>
      <SkeletonBlock className="h-6 w-16 shrink-0 rounded-full" />
    </li>
  );
}

export default function GetStartedLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-7 py-8 sm:py-10">
        <div className="flex max-w-3xl flex-col gap-3">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-9 w-72 sm:h-10" />
          <SkeletonBlock className="h-4 w-full max-w-xl" />
        </div>

        <div className="rounded-2xl border border-brand/15 bg-brand-soft/55 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-10" />
          </div>
          <SkeletonBlock className="mt-3 h-2 rounded-full" />
        </div>

        <ol className="grid gap-4">
          <StepSkeleton />
          <StepSkeleton />
          <StepSkeleton />
          <StepSkeleton />
        </ol>

        <SkeletonBlock className="h-10 w-40 rounded-xl" />
      </main>
    </SkeletonScreen>
  );
}
