import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { languageCodeToLocale } from "@/lib/domain/language";
import { formatFullDate } from "@/lib/format";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";
import { billing, t, trialDaysRemainingParts } from "@/lib/i18n";

// Wrapped for the same reason app/(dashboard)/page.tsx's currentTimeMs()
// is (see that file's comment) — eslint's react-hooks/purity rule flags a
// bare Date.now()/`new Date()` call in a component body, but this Server
// Component renders exactly once per request, so "now" as of render time
// is the intended value for the trial-days-remaining calculation below,
// not a purity bug.
function currentTimeMs(): number {
  return Date.now();
}

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

  const trialParts =
    trialDaysRemaining !== null ? trialDaysRemainingParts(languageCode, trialDaysRemaining) : null;

  const periodEndLabel =
    subscription.status === "trialing"
      ? billing.trialEndsOn
      : subscription.status === "active"
        ? billing.nextRenewalOn
        : billing.accessEndedOn;

  return (
    <main className="flex flex-col gap-8 py-8">
      <h1 className="text-[34px] font-semibold tracking-tight">{t(languageCode, billing.pageTitle)}</h1>

      <section className="flex max-w-md flex-col gap-2 rounded-xl border border-line p-5">
        <p className="text-sm">
          {t(languageCode, billing.statusPrefix)}{" "}
          <span className="font-medium">
            {t(languageCode, billing.statusLabels[subscription.status])}
          </span>
        </p>
        {trialDaysRemaining !== null && trialParts && (
          <p className="text-sm text-foreground/70">
            {trialParts.before && `${trialParts.before} `}
            <span className="font-mono tabular-nums">{trialDaysRemaining}</span>{" "}
            {trialParts.after}
          </p>
        )}
        {subscription.currentPeriodEnd && (
          <p className="text-sm text-foreground/70">
            {t(languageCode, periodEndLabel)}{" "}
            <span className="font-mono tabular-nums">
              {formatFullDate(subscription.currentPeriodEnd, locale)}
            </span>
            .
          </p>
        )}
        {subscription.status === "none" && (
          <p className="text-sm text-foreground/70">
            {t(languageCode, billing.noSubscriptionOnFile)}
          </p>
        )}
      </section>

      <ManageSubscriptionButton lang={languageCode} />

      <Link
        href="/dashboard/settings"
        className="text-sm text-foreground/70 hover:text-foreground"
      >
        {t(languageCode, billing.backToSettings)}
      </Link>
    </main>
  );
}
