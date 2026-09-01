"use client";

// The "Abo verwalten" action itself — a Client Component (same reasoning
// as ProjectsClient.tsx/SettingsClient.tsx: needs to show a pending state
// and surface an error inline rather than crash the page) that calls
// manageSubscription(repos) (lib/application/billing.ts, already existed
// since the skeleton phase — it wraps the SAME create-portal-session Edge
// Function built for Ticket 007) and redirects the browser to the
// returned Stripe portal URL.
//
// NOT fully end-to-end testable against the local Docker stack in this
// phase — create-portal-session is a real Supabase Edge Function that
// talks to Stripe with a real/test-mode secret key (Ticket 013), neither
// of which the local stack has configured. What IS verified: the button
// calls manageSubscription() correctly and surfaces the Edge Function's
// own error message (e.g. "Function not found" locally) instead of
// crashing — see the Phase 1e ticket section for the exact local test
// result.
import { useState } from "react";
import { manageSubscription } from "@/lib/application/billing";
import { getRepositories } from "@/lib/application/client";
import { manageSubscriptionButton, t, type Lang } from "@/lib/i18n";

const primaryButtonClass =
  "rounded-md bg-brand px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50";

const errorClass =
  "rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400";

export function ManageSubscriptionButton({ lang }: { lang: Lang }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      const url = await manageSubscription(repos);
      window.location.href = url;
      // Deliberately no setPending(false) on the success path — the
      // browser is navigating away, and resetting it first would let the
      // button flash back to its enabled state during that navigation.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t(lang, manageSubscriptionButton.error),
      );
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className={primaryButtonClass}
        >
          {pending ? t(lang, manageSubscriptionButton.opening) : t(lang, manageSubscriptionButton.manage)}
        </button>
      </div>
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}
