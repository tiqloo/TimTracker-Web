"use client";

// Ticket 110 — "Mitgliederübersicht". Same Client-Component shape as
// ProjectsClient.tsx: getRepositories() (lib/application/client.ts) + a
// use case, never lib/repositories/* directly.
import { useState } from "react";
import type { WorkspaceMemberRow, WorkspaceMemberStatus, InvitationRole } from "@/lib/application/workspace";
import { updateWorkspaceMemberRole } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import { workspaceMembers as i18nWorkspaceMembers, t, type Lang } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";

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

export function WorkspaceMembersClient({
  workspaceId,
  initialMembers,
  lang,
}: {
  workspaceId: string;
  initialMembers: WorkspaceMemberRow[];
  lang: Lang;
}) {
  const { showSuccess, showError } = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

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

  if (members.length === 0) {
    return <p className={errorMessageClass}>{t(lang, i18nWorkspaceMembers.emptyState)}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-medium text-text-secondary uppercase">
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnName)}</th>
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnEmail)}</th>
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnRole)}</th>
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnStatus)}</th>
              <th className="px-4 py-3">{t(lang, i18nWorkspaceMembers.columnSince)}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId ?? member.email} className="border-b border-line/60 last:border-0">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-secondary">{t(lang, i18nWorkspaceMembers.moreActionsComingSoon)}</p>
    </div>
  );
}
