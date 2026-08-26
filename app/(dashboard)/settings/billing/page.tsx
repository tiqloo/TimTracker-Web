import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { languageCodeToLocale } from "@/lib/domain/language";
import { formatFullDate } from "@/lib/format";
import type { SubscriptionStatus } from "@/lib/domain/subscription";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";

// Wrapped for the same reason app/(dashboard)/page.tsx's currentTimeMs()
// is (see that file's comment) — eslint's react-hooks/purity rule flags a
// bare Date.now()/`new Date()` call in a component body, but this Server
// Component renders exactly once per request, so "now" as of render time
// is the intended value for the trial-days-remaining calculation below,
// not a purity bug.
function currentTimeMs(): number {
  return Date.now();
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Testphase",
  active: "Aktiv",
  past_due: "Zahlung überfällig",
  canceled: "Gekündigt",
  unpaid: "Nicht bezahlt",
  incomplete_expired: "Unvollständig (abgelaufen)",
  none: "Kein Abo",
};

// "Abo verwalten" — Server Component for the initial status fetch, same
// split as every other (dashboard)/* page. Deliberately has NO
// canUseApp() access gate: Ticket 011 explicitly requires the
// upgrade/manage-subscription action to stay reachable "während Trial UND
// Nur-Lesen-Modus" (during trial AND read-only/expired mode) — gating
// this page behind the very entitlement check it exists to let a user fix
// would be self-defeating.
export default async function BillingSettingsPage() {
  const repos = await getRepositories();
  const [subscription, headerList] = await Promise.all([
    getSubscriptionStatus(repos),
    headers(),
  ]);
  const languageCode = await getEffectiveLanguageCode(
    repos,
    headerList.get("accept-language"),
  );
  const locale = languageCodeToLocale(languageCode);

  const nowMs = currentTimeMs();
  const trialDaysRemaining =
    subscription.status === "trialing" && subscription.currentPeriodEnd
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.currentPeriodEnd).getTime() - nowMs) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : null;

  return (
    <main className="flex flex-col gap-8 p-8">
      <h1 className="text-xl font-semibold">Abo verwalten</h1>

      <section className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
        <p className="text-sm">
          Status:{" "}
          <span className="font-medium">{STATUS_LABELS[subscription.status]}</span>
        </p>
        {trialDaysRemaining !== null && (
          <p className="text-sm text-black/70 dark:text-white/70">
            Noch {trialDaysRemaining} {trialDaysRemaining === 1 ? "Tag" : "Tage"}{" "}
            Testphase.
          </p>
        )}
        {subscription.currentPeriodEnd && (
          <p className="text-sm text-black/70 dark:text-white/70">
            {subscription.status === "trialing"
              ? "Testphase endet am"
              : subscription.status === "active"
                ? "Nächste Verlängerung am"
                : "Zugriff endete am"}{" "}
            {formatFullDate(subscription.currentPeriodEnd, locale)}.
          </p>
        )}
        {subscription.status === "none" && (
          <p className="text-sm text-black/70 dark:text-white/70">
            Kein Testzeitraum oder Abo hinterlegt.
          </p>
        )}
      </section>

      <ManageSubscriptionButton />

      <Link href="/settings" className="text-sm underline">
        Zurück zu den Einstellungen
      </Link>
    </main>
  );
}
