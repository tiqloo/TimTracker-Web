"use client";

// Ticket 102 — "Mitarbeiter einladen". Same Client-Component shape as
// CreateWorkspaceClient.tsx: getRepositories() (lib/application/client.ts)
// + a use case, never lib/repositories/* directly.
import { useState } from "react";
import type { InvitationRole } from "@/lib/application/workspace";
import { inviteWorkspaceMember } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { useToast } from "@/components/ToastProvider";
import { inviteMember as i18nInviteMember, t, type Lang } from "@/lib/i18n";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/ui/button-styles";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

function buildInviteLink(token: string): string {
  // `window.location.origin` rather than a server-provided base URL: this
  // is a Client Component, and the invite link must point at whichever
  // origin the admin is actually using right now (works identically for
  // local dev and production without an env var to keep in sync).
  return `${window.location.origin}/invite/accept?token=${encodeURIComponent(token)}`;
}

export function InviteMemberClient({ workspaceId, lang }: { workspaceId: string; lang: Lang }) {
  const { showSuccess, showError } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitationRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t(lang, i18nInviteMember.emailRequiredError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const invitation = await inviteWorkspaceMember(repos, workspaceId, trimmedEmail, role);
      setCreatedLink(buildInviteLink(invitation.token));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nInviteMember.submitError));
    } finally {
      setPending(false);
    }
  }

  async function handleCopyLink() {
    if (!createdLink) return;
    // Live-verified (2026-09-07): a denied/unavailable Clipboard API
    // (permission policy, older browser) rejects writeText() — without
    // this catch that surfaces only as an unhandled promise rejection,
    // silently leaving the admin believing the link was copied. The link
    // stays visible/selectable in the <code> block above either way, so
    // this is a friendlier failure, not a blocker.
    try {
      await navigator.clipboard.writeText(createdLink);
      showSuccess(t(lang, i18nInviteMember.linkCopied));
    } catch {
      showError(t(lang, i18nInviteMember.copyLinkError));
    }
  }

  if (createdLink) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground/70">{t(lang, i18nInviteMember.linkCreatedTitle)}</h2>
        <p className="text-sm text-foreground/70">{t(lang, i18nInviteMember.linkCreatedDescription)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded-md border border-line bg-paper px-3 py-2 text-xs">{createdLink}</code>
          <button type="button" onClick={handleCopyLink} className={secondaryButtonClass}>
            {t(lang, i18nInviteMember.copyLinkButton)}
          </button>
        </div>
        <div>
          <button type="button" onClick={() => setCreatedLink(null)} className={secondaryButtonClass}>
            {t(lang, i18nInviteMember.inviteAnotherButton)}
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-email" className="text-sm font-medium">
          {t(lang, i18nInviteMember.emailLabel)}
        </label>
        <input
          id="invite-email"
          autoFocus
          type="email"
          required
          disabled={pending}
          placeholder={t(lang, i18nInviteMember.emailPlaceholder)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="invite-role" className="text-sm font-medium">
          {t(lang, i18nInviteMember.roleLabel)}
        </label>
        <select
          id="invite-role"
          disabled={pending}
          value={role}
          onChange={(e) => setRole(e.target.value as InvitationRole)}
          className={inputClass}
        >
          <option value="member">{t(lang, i18nInviteMember.roleMember)}</option>
          <option value="admin">{t(lang, i18nInviteMember.roleAdmin)}</option>
        </select>
      </div>
      {error && (
        <p {...errorFeedbackProps} className={errorMessageClass}>
          {error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? t(lang, i18nInviteMember.submitting) : t(lang, i18nInviteMember.submitButton)}
        </button>
      </div>
    </form>
  );
}
