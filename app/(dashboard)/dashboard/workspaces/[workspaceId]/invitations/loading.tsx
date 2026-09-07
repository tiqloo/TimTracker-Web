import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 115's own AK ("Lade-Zustände sind definiert" — same convention as
// every other app/(dashboard)/**/loading.tsx, Ticket 072). Mirrors the H1 +
// description and WorkspaceInvitationsClient's table (one row per invitation).
function InvitationRow() {
  return (
    <div className="flex items-center gap-4 border-b border-line/60 px-4 py-3 last:border-0">
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-4 w-20" />
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-4 w-20" />
    </div>
  );
}

export default function WorkspaceInvitationsLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-8 py-8">
        <SkeletonHeading />
        <div className="overflow-hidden rounded-xl border border-line">
          <InvitationRow />
          <InvitationRow />
          <InvitationRow />
        </div>
      </main>
    </SkeletonScreen>
  );
}
