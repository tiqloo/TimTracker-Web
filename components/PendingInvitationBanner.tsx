"use client";

// Ticket 183 — Fall E aus Ticket 168 ("Intelligentes Routing nach
// Anmeldung"): ein Nutzer, der nie auf den ursprünglichen Einladungslink
// geklickt hat (z. B. weil er sich stattdessen ganz normal über /login
// anmeldet), sah bisher nirgendwo einen Hinweis auf eine wartende
// Einladung. Dieses Banner schließt genau diese Lücke — dismissbar,
// zeigt jeweils nur die erste/neueste offene Einladung (mehrere
// gleichzeitige sind ein seltener Randfall, siehe Ticket-Doku).
import { useState } from "react";
import { acceptPendingInvitation, switchActiveWorkspace, type PendingInvitationSummary } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { pendingInvitationBanner as i18n, pendingInvitationBannerMessage, t, type Lang } from "@/lib/i18n";
import { primaryButtonSmallClass, secondaryButtonSmallClass } from "@/lib/ui/button-styles";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// Plain top-level function, same reasoning as WorkspaceSwitcher.tsx's own
// reloadIntoActiveWorkspace: a full page load, not router.push()/
// refresh() — every (dashboard)/* Client Component seeds its local state
// from server-provided initial props only on first mount, so a soft
// navigation would leave stale previous-workspace data on screen.
function reloadIntoActiveWorkspace(): void {
  window.location.href = "/dashboard";
}

export function PendingInvitationBanner({ lang, invitations }: { lang: Lang; invitations: PendingInvitationSummary[] }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitation = invitations.find((row) => !dismissedIds.has(row.id));
  if (!invitation) return null;

  async function handleAccept() {
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      const accepted = await acceptPendingInvitation(repos, invitation!.id);
      await switchActiveWorkspace(repos, accepted.workspaceId);
      reloadIntoActiveWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, i18n.acceptError));
      setPending(false);
    }
  }

  function handleDismiss() {
    setDismissedIds((prev) => new Set(prev).add(invitation!.id));
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-foreground">{pendingInvitationBannerMessage(lang, invitation.workspaceName)}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={handleDismiss} disabled={pending} className={secondaryButtonSmallClass}>
          {t(lang, i18n.dismissButton)}
        </button>
        <button type="button" onClick={handleAccept} disabled={pending} className={primaryButtonSmallClass}>
          {pending ? t(lang, i18n.accepting) : t(lang, i18n.acceptButton)}
        </button>
      </div>
      {error && (
        <p {...errorFeedbackProps} className={`${errorMessageClass} sm:basis-full`}>
          {error}
        </p>
      )}
    </div>
  );
}
