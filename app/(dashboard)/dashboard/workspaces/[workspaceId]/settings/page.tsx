import type { Metadata } from "next";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getWorkspaceSettings, type WorkspaceSettings } from "@/lib/application/workspace";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import { WorkspaceSettingsClient } from "@/components/WorkspaceSettingsClient";
import { AccessGate } from "@/components/AccessGate";
import { workspaceSettings as i18n, t } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// "Workspace-Einstellungen" (Ticket 117) — same Server-Component-fetches/
// Client-Component-interacts split as members/invitations page.tsx.
// `workspaceId` itself is not pre-validated here — the server-side
// get_workspace_settings RPC (TimTracker-Starter repo) is the sole
// authoritative "is this caller actually a member of this workspace"
// check, same reasoning as every sibling workspaces/[workspaceId]/*
// page's own comment. Unlike members/invitations (owner/admin-only
// reads), this RPC is readable by ANY member — the write actions
// (update_workspace_settings/update_workspace_logo) are the owner/admin-
// gated part, enforced by a separate membership lookup below purely to
// decide whether the form renders editable or read-only (never the
// actual authorization boundary, which stays server-side).
// Ticket 185 (selbst gefunden): browser-tab title.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, i18n.pageTitle) };
}

export default async function WorkspaceSettingsPage({
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

  let settings: WorkspaceSettings | null = null;
  let isForbidden = false;
  try {
    settings = await getWorkspaceSettings(repos, workspaceId);
  } catch (err) {
    // Same 42501-detection convention as members/page.tsx's own comment.
    isForbidden = typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "42501";
  }

  const userId = await repos.auth.getAuthenticatedUserId();
  const membership = userId ? await repos.workspace.getMembership(userId, workspaceId) : null;
  const canEdit = membership?.role === "owner" || membership?.role === "admin";

  return (
    <main className="flex animate-content-fade-in flex-col gap-8 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, i18n.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">{t(lang, i18n.pageDescription)}</p>
      </div>
      {settings ? (
        <WorkspaceSettingsClient workspaceId={workspaceId} initialSettings={settings} canEdit={canEdit} lang={lang} />
      ) : (
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {t(lang, isForbidden ? i18n.forbiddenError : i18n.loadError)}
        </p>
      )}
    </main>
  );
}
