import type { SubscriptionStatus } from "@/lib/domain/subscription";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Testphase",
  active: "Aktiv (Zeitraum abgelaufen)",
  past_due: "Zahlung überfällig",
  canceled: "Gekündigt",
  unpaid: "Nicht bezahlt",
  incomplete_expired: "Unvollständig (abgelaufen)",
  none: "Kein Abo",
};

// Shared "no access" screen for Heute/Historie/Projekte — replaces four
// copies of the same inline block (page.tsx, history/page.tsx,
// history/[day]/page.tsx, projects/page.tsx) that had drifted into a dead
// end: plain text naming the raw SubscriptionStatus value with no actual
// way to act on it, despite already saying "Bitte Abo verwalten". Now
// includes the real ManageSubscriptionButton (opens the Stripe billing
// portal — the authoritative source for what's actually true about the
// subscription, which local Supabase data can lag behind if a renewal
// webhook was ever missed) and a link to the status page.
export function AccessGate({
  title,
  status,
}: {
  title: string;
  status: SubscriptionStatus;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 max-w-md rounded-xl border border-line p-5">
        <p className="text-sm text-foreground/70">
          Kein aktiver Testzeitraum oder Abo mehr.
        </p>
        {status !== "none" && (
          <p className="mt-1">
            <span className="font-mono text-xs tabular-nums text-foreground/50">
              Status: {STATUS_LABELS[status]}
            </span>
          </p>
        )}
        <div className="mt-4">
          <ManageSubscriptionButton />
        </div>
      </div>
    </div>
  );
}
