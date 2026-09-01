import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { listProjects } from "@/lib/application/projects";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import { ProjectsClient } from "@/components/ProjectsClient";
import { AccessGate } from "@/components/AccessGate";
import { projects as i18nProjects, t } from "@/lib/i18n";

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
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  // Same access gate as "Heute"/"Historie" — reused verbatim, not
  // reimplemented.
  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return (
      <AccessGate title={t(lang, i18nProjects.pageTitle)} status={subscription.status} lang={lang} />
    );
  }

  const projects = await listProjects(repos);

  return (
    <main className="flex flex-col gap-8 py-8">
      <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, i18nProjects.pageTitle)}</h1>
      <ProjectsClient initialProjects={projects} lang={lang} />
    </main>
  );
}
