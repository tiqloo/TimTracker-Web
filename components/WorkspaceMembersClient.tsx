"use client";

// Ticket 110 — "Mitgliederübersicht". Same Client-Component shape as
// ProjectsClient.tsx: getRepositories() (lib/application/client.ts) + a
// use case, never lib/repositories/* directly.
import { useState } from "react";
import type { WorkspaceMemberRow, WorkspaceMemberStatus, InvitationRole } from "@/lib/application/workspace";
import { updateWorkspaceMemberRole, removeWorkspaceMember } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import { workspaceMembers as i18nWorkspaceMembers, t, type Lang } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { secondaryButtonClass } from "@/lib/ui/button-styles";

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
  const [confirmingUserId, setConfirmingUserId] = useState<string | null>(null);

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

  async function handleRemove(userId: string) {
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
      setConfirmingUserId(null);
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
              return (
                <tr key={key} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">{member.displayName ?? t(lang, i18nWorkspaceMembers.noDisplayNameFallback)}</td>
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
                    {removable &&
                      (confirmingUserId === member.userId ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={pendingUserId === member.userId}
                            onClick={() => handleRemove(member.userId)}
                            className="text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                          >
                            {pendingUserId === member.userId ? t(lang, i18nWorkspaceMembers.removing) : t(lang, i18nWorkspaceMembers.confirmRemove)}
                          </button>
                          <button
                            type="button"
                            disabled={pendingUserId === member.userId}
                            onClick={() => setConfirmingUserId(null)}
                            className="text-xs text-text-secondary hover:underline"
                          >
                            {t(lang, i18nWorkspaceMembers.cancelRemove)}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingUserId(member.userId)}
                          className={`${secondaryButtonClass} px-2 py-1 text-xs`}
                        >
                          {t(lang, i18nWorkspaceMembers.removeButton)}
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-secondary">{t(lang, i18nWorkspaceMembers.moreActionsComingSoon)}</p>
    </div>
  );
}
