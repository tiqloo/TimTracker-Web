import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getWorkspaceSwitcherData } from "@/lib/application/workspace";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { LeaveWorkspaceClient } from "@/components/LeaveWorkspaceClient";
import { leaveWorkspace as i18nLeaveWorkspace, leaveWorkspacePageDescription, t } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// "Workspace verlassen" (Ticket 112) — deliberately NOT gated behind
// canUseApp/AccessGate like the invite/members pages: leaving a workspace
// must stay possible even in a read-only/expired-subscription state (the
// same reasoning account deletion in SettingsClient.tsx isn't gated
// either). Also deliberately NOT gated behind an owner/admin check —
// unlike members/page.tsx, ANY member may reach this page, since leaving
// is a self-service action, not workspace management (see
// leave_workspace's own migration comment, TimTracker-Starter repo).
//
// The workspace's name comes from getWorkspaceSwitcherData() (Ticket 103)
// rather than a new lookup — it already returns every workspace the
// caller belongs to, including its name, with no admin/owner requirement.
// A `workspaceId` the caller does NOT belong to simply won't be found in
// that list (never a 500/crash) — the confirm button below still calls
// the authoritative RPC either way, which would reject it server-side.
export default async function LeaveWorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  const { workspaces } = await getWorkspaceSwitcherData(repos);
  const workspace = workspaces.find((w) => w.workspaceId === workspaceId);

  if (!workspace || workspace.workspaceType === "PERSONAL") {
    // Ticket 112's own scope: leaving is only meaningful for an
    // organization workspace one is actually a member of. The personal
    // workspace can never be left (Ticket 097's own guarantee: every
    // account always has exactly one) — reachable only by manually typing
    // that workspace's id into the URL, not from any UI affordance.
    return (
      <main className="flex animate-content-fade-in flex-col gap-6 py-8">
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, i18nLeaveWorkspace.pageTitle)}</h1>
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, i18nLeaveWorkspace.notAMemberError)}
        </p>
      </main>
    );
  }

  return (
    <main className="flex animate-content-fade-in flex-col gap-6 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, i18nLeaveWorkspace.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          {leaveWorkspacePageDescription(lang, workspace.workspaceName)}
        </p>
      </div>
      <LeaveWorkspaceClient workspaceId={workspaceId} lang={lang} />
    </main>
  );
}
