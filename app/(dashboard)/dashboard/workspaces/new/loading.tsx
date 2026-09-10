import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 184 (selbst gefunden): fehlte bisher — jede andere
// app/(dashboard)/**-Route hat ein loading.tsx (Ticket 072), diese
// nicht, obwohl page.tsx (wie jede andere) echte serverseitige Aufrufe
// (getSubscriptionStatus/getEffectiveLanguageCode) vor dem Rendern
// macht. Mirrors CreateWorkspaceClient.tsx: H1 + Beschreibung + ein
// einzelnes Namensfeld.
export default function CreateWorkspaceLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-8 py-8">
        <SkeletonHeading />
        <SkeletonBlock className="h-10 w-full max-w-sm rounded-md" />
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
      </main>
    </SkeletonScreen>
  );
}
