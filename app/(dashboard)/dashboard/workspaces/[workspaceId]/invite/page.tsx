import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import { InviteMemberClient } from "@/components/InviteMemberClient";
import { AccessGate } from "@/components/AccessGate";
import { inviteMember as i18nInviteMember, t } from "@/lib/i18n";

// "Mitarbeiter einladen" (Ticket 102) — same Server Component split as
// workspaces/new/page.tsx: initial language/access-gate fetch here, the
// actual form (immediate submit feedback, copy-to-clipboard) in a Client
// Component. `workspaceId` itself is not validated/resolved here — the
// server-side create_workspace_invitation RPC (TimTracker-Starter repo)
// is the authoritative "is this caller actually an owner/admin of this
// workspace" check; this page would show the form to anyone who
// navigates here, but submitting only ever succeeds for a real owner/
// admin (Ticket 099's non-negotiable rule: never trust a client-side
// gate as the real authorization boundary).
export default async function InviteWorkspaceMemberPage({
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
      <AccessGate title={t(lang, i18nInviteMember.pageTitle)} status={subscription.status} lang={lang} />
    );
  }

  return (
    <main className="flex animate-content-fade-in flex-col gap-8 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, i18nInviteMember.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          {t(lang, i18nInviteMember.pageDescription)}
        </p>
      </div>
      <InviteMemberClient workspaceId={workspaceId} lang={lang} />
    </main>
  );
}
