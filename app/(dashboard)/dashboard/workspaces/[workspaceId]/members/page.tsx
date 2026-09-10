import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { listWorkspaceMembers, type WorkspaceMemberRow } from "@/lib/application/workspace";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import { WorkspaceMembersClient } from "@/components/WorkspaceMembersClient";
import { AccessGate } from "@/components/AccessGate";
import { workspaceMembers as i18nWorkspaceMembers, t } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// "Mitglieder" (Ticket 110) — same Server-Component-fetches/Client-Component-
// interacts split as projects/page.tsx. `workspaceId` itself is not
// pre-validated here — the server-side list_workspace_members RPC
// (TimTracker-Starter repo) is the sole authoritative "is this caller an
// owner/admin of this workspace" check (Ticket 099's non-negotiable rule),
// same reasoning as the sibling invite/page.tsx's own comment. A non-admin
// (or a member of a completely different workspace) navigating here
// directly gets the RPC's 42501 rejection, caught below and shown as a
// clear message instead of a crash.
// Ticket 185 (selbst gefunden): browser-tab title.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, i18nWorkspaceMembers.pageTitle) };
}

export default async function WorkspaceMembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return (
      <AccessGate title={t(lang, i18nWorkspaceMembers.pageTitle)} status={subscription.status} lang={lang} />
    );
  }

  const currentUserId = await repos.auth.getAuthenticatedUserId();

  let members: WorkspaceMemberRow[] | null = null;
  let isForbidden = false;
  try {
    members = await listWorkspaceMembers(repos, workspaceId);
  } catch (err) {
    // Postgrest surfaces a Postgres-raised exception's SQLSTATE as
    // `.code` — 42501 is exactly what list_workspace_members raises for a
    // non-owner/admin (see its own migration comment). Anything else
    // (network hiccup, workspace genuinely gone) gets the generic load
    // error instead of incorrectly claiming "you're not allowed".
    isForbidden = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "42501";
  }

  return (
    <main className="flex animate-content-fade-in flex-col gap-8 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, i18nWorkspaceMembers.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          {t(lang, i18nWorkspaceMembers.pageDescription)}
        </p>
      </div>
      {members ? (
        <WorkspaceMembersClient workspaceId={workspaceId} initialMembers={members} currentUserId={currentUserId} lang={lang} />
      ) : (
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, isForbidden ? i18nWorkspaceMembers.forbiddenError : i18nWorkspaceMembers.loadError)}
        </p>
      )}
    </main>
  );
}
