"use client";

// Ticket 115 — "Einladungsverwaltung". Same Client-Component shape as
// WorkspaceMembersClient.tsx: getRepositories() (lib/application/client.ts)
// + a use case, never lib/repositories/* directly.
import { useState } from "react";
import type { InvitationRole, WorkspaceInvitationRow } from "@/lib/application/workspace";
import {
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  updateWorkspaceInvitationRole,
} from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import { workspaceInvitations as i18n, t, type Lang } from "@/lib/i18n";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { secondaryButtonClass } from "@/lib/ui/button-styles";

const inputClass =
  "rounded-md border border-line bg-transparent px-2 py-1 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

type InvitationStatus = "pending" | "expired" | "revoked" | "accepted";

function statusOf(row: WorkspaceInvitationRow): InvitationStatus {
  if (row.acceptedAt) return "accepted";
  if (row.revokedAt) return "revoked";
  if (new Date(row.expiresAt).getTime() < Date.now()) return "expired";
  return "pending";
}

function statusLabel(lang: Lang, status: InvitationStatus): string {
  switch (status) {
    case "pending":
      return t(lang, i18n.statusPending);
    case "expired":
      return t(lang, i18n.statusExpired);
    case "revoked":
      return t(lang, i18n.statusRevoked);
    case "accepted":
      return t(lang, i18n.statusAccepted);
  }
}

// Every action here only ever succeeds server-side for a still-open
// invitation (RPCs reject accepted/revoked ones, see the migration's own
// comments) — hiding the controls for those rows avoids offering a button
// that could only ever fail with a confusing error.
function isActionable(status: InvitationStatus): boolean {
  return status === "pending" || status === "expired";
}

function buildInviteLink(token: string): string {
  return `${window.location.origin}/invite/accept?token=${encodeURIComponent(token)}`;
}

// No workspaceId prop: every action here (resend/revoke/role-change)
// targets a specific invitation by its own id — the RPCs derive the
// owning workspace server-side and re-check the caller's role against it,
// this component never needs to pass a workspace id at all.
export function WorkspaceInvitationsClient({
  initialInvitations,
  lang,
}: {
  initialInvitations: WorkspaceInvitationRow[];
  lang: Lang;
}) {
  const { showSuccess, showError } = useToast();
  const [invitations, setInvitations] = useState(initialInvitations);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [resentLinks, setResentLinks] = useState<Record<string, string>>({});

  async function handleResend(invitationId: string) {
    setPendingId(invitationId);
    try {
      const repos = getRepositories();
      const resent = await resendWorkspaceInvitation(repos, invitationId);
      setInvitations((prev) => prev.map((row) => (row.id === invitationId ? { ...row, expiresAt: resent.expiresAt } : row)));
      setResentLinks((prev) => ({ ...prev, [invitationId]: buildInviteLink(resent.token) }));
      showSuccess(t(lang, i18n.resendSuccess));
    } catch {
      showError(t(lang, i18n.resendError));
    } finally {
      setPendingId(null);
    }
  }

  async function handleCopyLink(invitationId: string) {
    const link = resentLinks[invitationId];
    if (!link) return;
    // Same defensive try/catch as InviteMemberClient.tsx's copy handler —
    // a denied/unavailable Clipboard API must not surface as an unhandled
    // promise rejection, the link stays visible/selectable either way.
    try {
      await navigator.clipboard.writeText(link);
      showSuccess(t(lang, i18n.linkCopied));
    } catch {
      showError(t(lang, i18n.copyLinkError));
    }
  }

  async function handleRevoke(invitationId: string) {
    setPendingId(invitationId);
    try {
      const repos = getRepositories();
      await revokeWorkspaceInvitation(repos, invitationId);
      setInvitations((prev) =>
        prev.map((row) => (row.id === invitationId ? { ...row, revokedAt: row.revokedAt ?? new Date().toISOString() } : row)),
      );
      showSuccess(t(lang, i18n.revokeSuccess));
    } catch {
      showError(t(lang, i18n.revokeError));
    } finally {
      setPendingId(null);
      setConfirmRevokeId(null);
    }
  }

  async function handleRoleChange(invitationId: string, role: InvitationRole) {
    setPendingId(invitationId);
    try {
      const repos = getRepositories();
      await updateWorkspaceInvitationRole(repos, invitationId, role);
      setInvitations((prev) => prev.map((row) => (row.id === invitationId ? { ...row, role } : row)));
      showSuccess(t(lang, i18n.roleChangeSuccess));
    } catch {
      showError(t(lang, i18n.roleChangeError));
    } finally {
      setPendingId(null);
    }
  }

  if (invitations.length === 0) {
    return <p className={errorMessageClass}>{t(lang, i18n.emptyState)}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-medium text-text-secondary uppercase">
            <th className="px-4 py-3">{t(lang, i18n.columnEmail)}</th>
            <th className="px-4 py-3">{t(lang, i18n.columnRole)}</th>
            <th className="px-4 py-3">{t(lang, i18n.columnSent)}</th>
            <th className="px-4 py-3">{t(lang, i18n.columnStatus)}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => {
            const status = statusOf(invitation);
            const actionable = isActionable(status);
            const resentLink = resentLinks[invitation.id];
            const isPending = pendingId === invitation.id;
            return (
              <tr key={invitation.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 text-text-secondary">{invitation.email}</td>
                <td className="px-4 py-3">
                  {actionable ? (
                    <select
                      className={inputClass}
                      value={invitation.role}
                      disabled={isPending}
                      onChange={(e) => handleRoleChange(invitation.id, e.target.value as InvitationRole)}
                    >
                      <option value="member">{t(lang, i18n.roleMember)}</option>
                      <option value="admin">{t(lang, i18n.roleAdmin)}</option>
                    </select>
                  ) : invitation.role === "admin" ? (
                    t(lang, i18n.roleAdmin)
                  ) : (
                    t(lang, i18n.roleMember)
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">{new Date(invitation.sentAt).toLocaleDateString(lang)}</td>
                <td className="px-4 py-3">{statusLabel(lang, status)}</td>
                <td className="px-4 py-3 text-right">
                  {actionable && (
                    <div className="flex flex-col items-end gap-2">
                      {confirmRevokeId === invitation.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRevoke(invitation.id)}
                            className="text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                          >
                            {isPending ? t(lang, i18n.revoking) : t(lang, i18n.confirmRevoke)}
                          </button>
                          <button type="button" disabled={isPending} onClick={() => setConfirmRevokeId(null)} className="text-xs text-text-secondary hover:underline">
                            {t(lang, i18n.cancelRevoke)}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleResend(invitation.id)}
                            className={`${secondaryButtonClass} px-2 py-1 text-xs`}
                          >
                            {isPending ? t(lang, i18n.resending) : t(lang, i18n.resendButton)}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setConfirmRevokeId(invitation.id)}
                            className="text-xs font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                          >
                            {t(lang, i18n.revokeButton)}
                          </button>
                        </div>
                      )}
                      {resentLink && (
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-xs text-text-secondary">{t(lang, i18n.linkCreatedDescription)}</p>
                          <div className="flex items-center gap-2">
                            <code className="break-all rounded-md border border-line bg-paper px-2 py-1 text-xs">{resentLink}</code>
                            <button type="button" onClick={() => handleCopyLink(invitation.id)} className={`${secondaryButtonClass} px-2 py-1 text-xs`}>
                              {t(lang, i18n.copyLinkButton)}
                            </button>
                          </div>
                        </div>
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
  );
}
