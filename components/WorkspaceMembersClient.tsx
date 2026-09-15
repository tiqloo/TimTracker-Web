"use client";

// Ticket 110 — "Mitgliederübersicht". Same Client-Component shape as
// ProjectsClient.tsx: getRepositories() (lib/application/client.ts) + a
// use case, never lib/repositories/* directly.
import { useState } from "react";
import Link from "next/link";
import type { WorkspaceMemberRow, WorkspaceMemberStatus, InvitationRole } from "@/lib/application/workspace";
import { updateWorkspaceMemberRole, removeWorkspaceMember, transferWorkspaceOwnership } from "@/lib/application/workspace";
import { ReauthenticationFailedError } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import { workspaceMembers as i18nWorkspaceMembers, t, type Lang } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { secondaryButtonClass } from "@/lib/ui/button-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

const inputClass =
  "rounded-md border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

function statusLabel(lang: Lang, status: WorkspaceMemberStatus): string {
  switch (status) {
    case "active":
      return t(lang, i18nWorkspaceMembers.statusActive);
    case "invited":
      return t(lang, i18nWorkspaceMembers.statusInvited);
    case "invitation_expired":
      return t(lang, i18nWorkspaceMembers.statusInvitationExpired);
    case "invitation_revoked":
      return t(lang, i18nWorkspaceMembers.statusInvitationRevoked);
  }
}

// A role is only ever changeable for an ACTIVE membership — a pending/
// expired/revoked invitation has no `userId` to target at all (see
// WorkspaceMemberRow's own doc), and changing its role is Ticket 115's
// own "Einladungsverwaltung" scope, not this overview's.
function isRoleEditable(row: WorkspaceMemberRow): row is WorkspaceMemberRow & { userId: string } {
  return row.status === "active" && row.userId !== null && row.role !== "owner";
}

// Ticket 111 — same eligibility as role-editing (real, non-owner
// membership), MINUS the caller's own row: self-removal is rejected
// server-side (Ticket 112's own "leave workspace" flow), no point
// offering a button that can only ever fail.
function isRemovable(row: WorkspaceMemberRow, currentUserId: string | null): row is WorkspaceMemberRow & { userId: string } {
  return isRoleEditable(row) && row.userId !== currentUserId;
}

// Ticket 113 — only an existing, active ADMIN (not a plain member, not
// already the owner) is ever a valid transfer target — same rule the
// transfer_workspace_ownership RPC itself enforces, checked here purely
// to avoid offering a button that could only ever fail server-side.
function isTransferTarget(row: WorkspaceMemberRow, currentUserId: string | null): row is WorkspaceMemberRow & { userId: string } {
  return row.status === "active" && row.userId !== null && row.role === "admin" && row.userId !== currentUserId;
}

type RowAction = { userId: string; mode: "remove" | "transfer" };

export function WorkspaceMembersClient({
  workspaceId,
  initialMembers,
  currentUserId,
  lang,
}: {
  workspaceId: string;
  initialMembers: WorkspaceMemberRow[];
  currentUserId: string | null;
  lang: Lang;
}) {
  const { showSuccess, showError } = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<RowAction | null>(null);
  const [transferPassword, setTransferPassword] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);

  // Ticket 113 AK: "Ziel ist eine aktive Admin-Membership" — offered by
  // ANYONE viewing this page, but only ever succeeds server-side when the
  // viewer is actually the current owner (same "the RPC is the sole
  // authoritative check" reasoning as every other action here). Hiding
  // the button entirely for a non-owner viewer would need to know the
  // viewer's OWN role, derivable from `members` itself — done here so a
  // plain admin viewing this page (they CAN load it, Ticket 110 AK) isn't
  // shown a button that could only ever fail with a confusing 403.
  const viewerIsOwner = members.some((member) => member.userId === currentUserId && member.role === "owner");

  function closeAction() {
    setActiveAction(null);
    setTransferPassword("");
    setTransferError(null);
  }

  async function handleRoleChange(userId: string, role: InvitationRole) {
    setPendingUserId(userId);
    try {
      const repos = getRepositories();
      await updateWorkspaceMemberRole(repos, workspaceId, userId, role);
      setMembers((prev) => prev.map((member) => (member.userId === userId ? { ...member, role } : member)));
      showSuccess(t(lang, i18nWorkspaceMembers.roleChangeSuccess));
    } catch {
      showError(t(lang, i18nWorkspaceMembers.roleChangeError));
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleRemove(userId: string | null) {
    if (!userId) return;
    setPendingUserId(userId);
    try {
      const repos = getRepositories();
      await removeWorkspaceMember(repos, workspaceId, userId);
      setMembers((prev) => prev.filter((member) => member.userId !== userId));
      showSuccess(t(lang, i18nWorkspaceMembers.removeSuccess));
    } catch {
      showError(t(lang, i18nWorkspaceMembers.removeError));
    } finally {
      setPendingUserId(null);
      closeAction();
    }
  }

  async function handleTransfer(userId: string | null) {
    if (!userId) return;
    setTransferError(null);
    setPendingUserId(userId);
    try {
      const repos = getRepositories();
      await transferWorkspaceOwnership(repos, workspaceId, userId, transferPassword);
      setMembers((prev) =>
        prev.map((member) => {
          if (member.userId === userId) return { ...member, role: "owner" };
          if (member.userId === currentUserId) return { ...member, role: "admin" };
          return member;
        }),
      );
      showSuccess(t(lang, i18nWorkspaceMembers.transferSuccess));
      closeAction();
    } catch (err) {
      setTransferError(
        err instanceof ReauthenticationFailedError
          ? t(lang, i18nWorkspaceMembers.transferWrongPasswordError)
          : t(lang, i18nWorkspaceMembers.transferError),
      );
    } finally {
      setPendingUserId(null);
    }
  }

  if (members.length === 0) {
    return <p className={errorMessageClass}>{t(lang, i18nWorkspaceMembers.emptyState)}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-medium text-text-secondary uppercase">
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnName)}</th>
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnEmail)}</th>
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnRole)}</th>
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnStatus)}</th>
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnSince)}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const key = member.userId ?? member.email;
              const removable = isRemovable(member, currentUserId);
              const transferTarget = viewerIsOwner && isTransferTarget(member, currentUserId);
              const action = activeAction?.userId === member.userId ? activeAction.mode : null;
              return (
                <tr key={key} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    {/* Ticket 192 (selbst gefunden) — only an "active" row
                        has a real userId to link a profile for; a
                        pending/expired/revoked invitation has no account
                        yet (same reasoning as isRoleEditable() above). */}
                    {member.userId ? (
                      <Link
                        href={`/dashboard/workspaces/${workspaceId}/members/${member.userId}`}
                        className="text-foreground underline-offset-2 hover:underline focus-visible:underline"
                      >
                        {member.displayName ?? t(lang, i18nWorkspaceMembers.noDisplayNameFallback)}
                      </Link>
                    ) : (
                      member.displayName ?? t(lang, i18nWorkspaceMembers.noDisplayNameFallback)
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{member.email}</td>
                  <td className="px-4 py-3">
                    {isRoleEditable(member) ? (
                      <select
                        className={inputClass}
                        value={member.role}
                        disabled={pendingUserId === member.userId}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value as InvitationRole)}
                      >
                        <option value="member">{t(lang, i18nWorkspaceMembers.roleMember)}</option>
                        <option value="admin">{t(lang, i18nWorkspaceMembers.roleAdmin)}</option>
                      </select>
                    ) : member.role === "owner" ? (
                      t(lang, i18nWorkspaceMembers.roleOwner)
                    ) : member.role === "admin" ? (
                      t(lang, i18nWorkspaceMembers.roleAdmin)
                    ) : (
                      t(lang, i18nWorkspaceMembers.roleMember)
                    )}
                  </td>
                  <td className="px-4 py-3">{statusLabel(lang, member.status)}</td>
                  <td className="px-4 py-3 text-text-secondary">{new Date(member.since).toLocaleDateString(lang)}</td>
                  <td className="px-4 py-3 text-right">
                    {action === "remove" && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={pendingUserId === member.userId}
                          onClick={() => handleRemove(member.userId)}
                          className="text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                        >
                          {pendingUserId === member.userId ? t(lang, i18nWorkspaceMembers.removing) : t(lang, i18nWorkspaceMembers.confirmRemove)}
                        </button>
                        <button type="button" disabled={pendingUserId === member.userId} onClick={closeAction} className="text-xs text-text-secondary hover:underline">
                          {t(lang, i18nWorkspaceMembers.cancelRemove)}
                        </button>
                      </div>
                    )}
                    {action === "transfer" && (
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-xs text-text-secondary">{t(lang, i18nWorkspaceMembers.transferPasswordPrompt)}</p>
                        <input
                          type="password"
                          autoComplete="current-password"
                          autoFocus
                          disabled={pendingUserId === member.userId}
                          value={transferPassword}
                          onChange={(e) => setTransferPassword(e.target.value)}
                          className={inputClass}
                        />
                        {transferError && (
                          <p {...errorFeedbackProps} className="text-xs text-red-700 dark:text-red-400">
                            {transferError}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={pendingUserId === member.userId || !transferPassword}
                            onClick={() => handleTransfer(member.userId)}
                            className="text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                          >
                            {pendingUserId === member.userId ? t(lang, i18nWorkspaceMembers.transferring) : t(lang, i18nWorkspaceMembers.confirmTransfer)}
                          </button>
                          <button type="button" disabled={pendingUserId === member.userId} onClick={closeAction} className="text-xs text-text-secondary hover:underline">
                            {t(lang, i18nWorkspaceMembers.cancelRemove)}
                          </button>
                        </div>
                      </div>
                    )}
                    {!action && (
                      <div className="flex items-center justify-end gap-2">
                        {transferTarget && (
                          <button
                            type="button"
                            onClick={() => setActiveAction({ userId: member.userId, mode: "transfer" })}
                            className={`${secondaryButtonClass} px-2 py-1 text-xs`}
                          >
                            {t(lang, i18nWorkspaceMembers.transferButton)}
                          </button>
                        )}
                        {removable && (
                          <button
                            type="button"
                            onClick={() => setActiveAction({ userId: member.userId, mode: "remove" })}
                            className={`${secondaryButtonClass} px-2 py-1 text-xs`}
                          >
                            {t(lang, i18nWorkspaceMembers.removeButton)}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4">
        <Link href={`/dashboard/workspaces/${workspaceId}/invitations`} className="text-xs font-medium text-brand hover:underline">
          {t(lang, i18nWorkspaceMembers.manageInvitationsLink)}
        </Link>
        <Link href={`/dashboard/workspaces/${workspaceId}/settings`} className="text-xs font-medium text-brand hover:underline">
          {t(lang, i18nWorkspaceMembers.workspaceSettingsLink)}
        </Link>
      </div>
    </div>
  );
}
