"use client";

// Ticket 112 — "Workspace verlassen". Same Client-Component shape as
// AcceptInvitationClient.tsx: a single confirm action, immediate pending/
// error feedback.
import { useState } from "react";
import Link from "next/link";
import { leaveWorkspace } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { authButtonClass, authErrorClass } from "@/components/AuthCard";
import { secondaryButtonClass } from "@/lib/ui/button-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";
import { leaveWorkspace as i18nLeaveWorkspace, t, type Lang } from "@/lib/i18n";

export function LeaveWorkspaceClient({
  workspaceId,
  lang,
}: {
  workspaceId: string;
  lang: Lang;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ticket 112 AK: "Der letzte Owner ... wird zur Ownership-Übertragung
  // aufgefordert" — the RPC rejects with 23514 (the existing
  // protect_last_workspace_owner trigger, TimTracker-Starter repo), caught
  // here for a specific, actionable message instead of the generic error.
  // Ownership transfer itself doesn't exist yet (Ticket 113), so this
  // stays a plain explanation, not a working link — same "coming in its
  // own step" pattern already used for remove/resend on the members page.
  const [isLastOwner, setIsLastOwner] = useState(false);
  const [left, setLeft] = useState(false);

  async function handleLeave() {
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      await leaveWorkspace(repos, workspaceId);
      setLeft(true);
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? (err as { code?: string }).code : undefined;
      if (code === "23514") {
        setIsLastOwner(true);
      } else {
        setError(err instanceof Error ? err.message : t(lang, i18nLeaveWorkspace.leaveError));
      }
    } finally {
      setPending(false);
    }
  }

  if (left) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <p className="text-sm font-medium">{t(lang, i18nLeaveWorkspace.leftTitle)}</p>
        <a href="/dashboard" className={authButtonClass}>
          {t(lang, i18nLeaveWorkspace.goToDashboardButton)}
        </a>
      </div>
    );
  }

  if (isLastOwner) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
        <p {...errorFeedbackProps} className={authErrorClass}>
          {t(lang, i18nLeaveWorkspace.lastOwnerError)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      {error && (
        <p {...errorFeedbackProps} className={authErrorClass}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={handleLeave} disabled={pending} className={authButtonClass}>
          {pending ? t(lang, i18nLeaveWorkspace.leaving) : t(lang, i18nLeaveWorkspace.confirmButton)}
        </button>
        <Link href="/dashboard" className={`${secondaryButtonClass} inline-flex items-center`}>
          {t(lang, i18nLeaveWorkspace.cancelButton)}
        </Link>
      </div>
    </div>
  );
}
