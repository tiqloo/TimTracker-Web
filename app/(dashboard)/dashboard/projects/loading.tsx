import { SkeletonBlock, SkeletonHeading, SkeletonScreen } from "@/components/Skeleton";

// Ticket 072: instant-feedback skeleton for "Projekte"
// (app/(dashboard)/dashboard/projects/page.tsx). Mirrors the H1, the
// create-project form card, and ProjectsClient's divided list of project
// rows (each with a small color swatch, see components/ProjectsClient.tsx).
function ProjectRow() {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3 first:border-t">
      <SkeletonBlock className="h-3.5 w-3.5 shrink-0 rounded-full" />
      <SkeletonBlock className="h-4 w-40" />
    </div>
  );
}

export default function ProjectsLoading() {
  return (
    <SkeletonScreen>
      <main className="flex flex-col gap-8 py-8">
        <SkeletonHeading />

        <div className="rounded-2xl border border-line/90 bg-surface p-5">
          <SkeletonBlock className="h-9 w-full max-w-sm rounded-xl" />
        </div>

        <div className="flex flex-col">
          <ProjectRow />
          <ProjectRow />
          <ProjectRow />
          <ProjectRow />
        </div>
      </main>
    </SkeletonScreen>
  );
}
