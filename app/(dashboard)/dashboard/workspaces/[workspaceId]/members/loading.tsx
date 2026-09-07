import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 110's own AK ("Lade-... Zustände sind definiert") — same
// instant-feedback skeleton convention as every other app/(dashboard)/**/
// loading.tsx (Ticket 072). Mirrors the H1 + description and
// WorkspaceMembersClient's table (one row per member/invitation).
function MemberRow() {
  return (
    <div className="flex items-center gap-4 border-b border-line/60 px-4 py-3 last:border-0">
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-4 w-20" />
      <SkeletonBlock className="h-4 w-24" />
    </div>
  );
}

export default function WorkspaceMembersLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-8 py-8">
        <SkeletonHeading />
        <div className="overflow-hidden rounded-xl border border-line">
          <MemberRow />
          <MemberRow />
          <MemberRow />
        </div>
      </main>
    </SkeletonScreen>
  );
}
