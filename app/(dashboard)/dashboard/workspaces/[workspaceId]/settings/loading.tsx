import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 117's own AK ("Lade-...-feedback") — same convention as every
// other app/(dashboard)/**/loading.tsx (Ticket 072).
export default function WorkspaceSettingsLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-8 py-8">
        <SkeletonHeading />
        <div className="flex flex-col gap-3 rounded-xl border border-line p-5">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-9 w-full" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-9 w-full" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-9 w-full" />
        </div>
      </main>
    </SkeletonScreen>
  );
}
