import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { listWorkspaceInvitations, type WorkspaceInvitationRow } from "@/lib/application/workspace";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import { WorkspaceInvitationsClient } from "@/components/WorkspaceInvitationsClient";
import { AccessGate } from "@/components/AccessGate";
import { workspaceInvitations as i18n, t } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// "Einladungsverwaltung" (Ticket 115) — same Server-Component-fetches/
// Client-Component-interacts split as members/page.tsx. `workspaceId`
// itself is not pre-validated here — the server-side list_workspace_invitations
// RPC (TimTracker-Starter repo) is the sole authoritative "is this caller
// an owner/admin of this workspace" check (Ticket 099's non-negotiable
// rule), same reasoning as the sibling members/page.tsx's own comment. A
// non-admin (or a member of a completely different workspace) navigating
// here directly gets the RPC's 42501 rejection, caught below and shown as
// a clear message instead of a crash.
// Ticket 185 (selbst gefunden): browser-tab title.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, i18n.pageTitle) };
}

export default async function WorkspaceInvitationsPage({
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
    return <AccessGate title={t(lang, i18n.pageTitle)} status={subscription.status} lang={lang} />;
  }

  let invitations: WorkspaceInvitationRow[] | null = null;
  let isForbidden = false;
  try {
    invitations = await listWorkspaceInvitations(repos, workspaceId);
  } catch (err) {
    // Same 42501-detection convention as members/page.tsx's own comment.
    isForbidden = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "42501";
  }

  return (
    <main className="flex animate-content-fade-in flex-col gap-8 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, i18n.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{t(lang, i18n.pageDescription)}</p>
      </div>
      {invitations ? (
        <>
          <WorkspaceInvitationsClient initialInvitations={invitations} lang={lang} />
          <Link href={`/dashboard/workspaces/${workspaceId}/members`} className="text-xs font-medium text-brand hover:underline">
            {t(lang, i18n.backToMembersLink)}
          </Link>
        </>
      ) : (
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, isForbidden ? i18n.forbiddenError : i18n.loadError)}
        </p>
      )}
    </main>
  );
}
