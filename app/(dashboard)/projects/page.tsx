import { getRepositories } from "@/lib/application/server";
import { listProjects } from "@/lib/application/projects";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { canUseApp } from "@/lib/domain/subscription";
import { ProjectsClient } from "@/components/ProjectsClient";

// "Projekte" — full CRUD (create, rename, archive/unarchive), not
// read-only. This is explicitly the point where the web app goes beyond
// the native apps' original "read-only lite" idea (Ticket 018; see Ticket
// 014's 2026-08-25 update in TimTracker-Starter: the goal is full parity
// so Dashboard/Projects views can eventually be removed from the native
// apps). A flat list, not nested — same convention as "Heute"/"Historie".
//
// This page (Server Component) only does the initial fetch + access gate,
// same split as history/page.tsx. All the interactive CRUD work (create
// form, inline rename, archive toggle, duplicate-name warning) lives in
// components/ProjectsClient.tsx, a Client Component — needed because those
// actions are user-driven mutations with immediate UI feedback, the same
// reason app/(auth)/register/page.tsx etc. are Client Components rather
// than server actions/route handlers.
export default async function ProjectsPage() {
  const repos = await getRepositories();

  // Same access gate as "Heute"/"Historie" — reused verbatim, not
  // reimplemented.
  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return (
      <main className="p-8">
        <h1 className="mb-2 text-xl font-semibold">Projekte</h1>
        <p className="text-sm text-black/70 dark:text-white/70">
          Kein aktiver Testzeitraum oder Abo mehr
          {subscription.status !== "none" ? ` (Status: ${subscription.status})` : ""}.
          Bitte Abo verwalten, um wieder auf deine Daten zuzugreifen.
        </p>
      </main>
    );
  }

  const projects = await listProjects(repos);

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-xl font-semibold">Projekte</h1>
      <ProjectsClient initialProjects={projects} />
    </main>
  );
}
