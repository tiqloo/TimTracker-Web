"use client";

// Ticket 102 — the actual "annehmen" action, split out of
// app/invite/accept/page.tsx (a Server Component) for the same reason
// every other mutation in this app lives in a Client Component: immediate
// pending/error feedback without a full page reload.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptWorkspaceInvitation } from "@/lib/application/workspace";
import { getRepositories } from "@/lib/application/client";
import { authButtonClass, authErrorClass } from "@/components/AuthCard";
import { errorFeedbackProps } from "@/lib/ui/feedback";
import { acceptInvite as i18nAcceptInvite, t, type Lang } from "@/lib/i18n";

export function AcceptInvitationClient({ token, lang }: { token: string; lang: Lang }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function handleAccept() {
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      await acceptWorkspaceInvitation(repos, token);
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, i18nAcceptInvite.acceptError));
    } finally {
      setPending(false);
    }
  }

  if (accepted) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">{t(lang, i18nAcceptInvite.acceptedTitle)}</p>
        <button type="button" onClick={() => router.push("/dashboard")} className={authButtonClass}>
          {t(lang, i18nAcceptInvite.goToDashboardButton)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p {...errorFeedbackProps} className={authErrorClass}>
          {error}
        </p>
      )}
      <button type="button" onClick={handleAccept} disabled={pending} className={authButtonClass}>
        {pending ? t(lang, i18nAcceptInvite.accepting) : t(lang, i18nAcceptInvite.acceptButton)}
      </button>
    </div>
  );
}
