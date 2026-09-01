import type { SubscriptionStatus } from "@/lib/domain/subscription";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";
import { accessGate, t, type Lang } from "@/lib/i18n";

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
  lang,
}: {
  title: string;
  status: SubscriptionStatus;
  lang: Lang;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl animate-content-fade-in px-6 py-8 sm:px-8">
      {/* Ticket 048: same Dashboard H1 (34px) tier as every other
          (dashboard)/* page's top heading — see app/(dashboard)/dashboard/
          page.tsx's comment for the full reasoning; this is the no-access
          fallback for the same pages, so it gets the same heading tier. */}
      <h1 className="text-[34px] font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 max-w-md rounded-xl border border-line bg-surface p-5">
        <p className="text-sm text-text-secondary">{t(lang, accessGate.message)}</p>
        {status !== "none" && (
          <p className="mt-1">
            <span className="font-mono text-xs tabular-nums text-foreground/50">
              {t(lang, accessGate.statusPrefix)} {t(lang, accessGate.statusLabels[status])}
            </span>
          </p>
        )}
        <div className="mt-4">
          <ManageSubscriptionButton lang={lang} />
        </div>
      </div>
    </div>
  );
}
