"use client";

// "Abo abschließen" — for users without a Stripe customer yet (trial, none,
// expired): starts Stripe Checkout via create-checkout-session. Mirrors
// ManageSubscriptionButton, which covers paying subscribers.
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { startSubscriptionCheckout } from "@/lib/application/billing";
import { getRepositories } from "@/lib/application/client";
import { startCheckoutButton, t, type Lang } from "@/lib/i18n";
import { primaryButtonClass } from "@/lib/ui/button-styles";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps } from "@/lib/ui/feedback";

// Ticket 048: lib/ui/status-styles.ts (--danger token) — was locally
// defined before this ticket's status-token consolidation pass.
const errorClass = errorMessageClass;

export function StartCheckoutButton({ lang }: { lang: Lang }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      const url = await startSubscriptionCheckout(repos);
      window.location.href = url;
      // Deliberately no setPending(false) on the success path — the
      // browser is navigating away, and resetting it first would let the
      // button flash back to its enabled state during that navigation.
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t(lang, startCheckoutButton.error),
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
          {pending ? t(lang, startCheckoutButton.opening) : t(lang, startCheckoutButton.start)}
          {!pending && <ExternalLink size={16} strokeWidth={1.8} aria-hidden="true" />}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {pending ? t(lang, startCheckoutButton.opening) : ""}
      </span>
      {error && <p {...errorFeedbackProps} className={errorClass}>{error}</p>}
    </div>
  );
}
