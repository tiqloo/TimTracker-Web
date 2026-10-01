import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, CalendarDays, CreditCard, ShieldCheck } from "lucide-react";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { languageCodeToLocale } from "@/lib/domain/language";
import { formatFullDate } from "@/lib/format";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";
import { billing, t, trialDaysRemainingParts } from "@/lib/i18n";
import { getBillingStatusPresentation } from "@/lib/ui/billing-status";

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
// Ticket 185 (selbst gefunden): browser-tab title.
export async function generateMetadata(): Promise<Metadata> {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  return { title: t(lang, billing.pageTitle) };
}

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

  const statusPresentation = getBillingStatusPresentation(subscription.status);
  const periodEndLabel = billing[statusPresentation.periodLabel];
  const statusToneClass = {
    success: "border-success/25 bg-success/10",
    warning: "border-warning/30 bg-warning/10",
    neutral: "border-line bg-paper",
  }[statusPresentation.tone];
  const statusDotClass = {
    success: "bg-success",
    warning: "bg-warning",
    neutral: "bg-text-secondary",
  }[statusPresentation.tone];

  return (
    <main className="flex max-w-3xl animate-content-fade-in flex-col gap-7 py-8 sm:py-10">
      <Link
        href="/dashboard/settings"
        className="-ml-2 inline-flex w-fit items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-text-secondary outline-none transition-colors duration-150 hover:bg-paper hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
        {t(languageCode, billing.backToSettings)}
      </Link>

      <header className="max-w-2xl">
        <h1 className="text-[34px] font-semibold tracking-[-0.035em] sm:text-[40px]">
          {t(languageCode, billing.pageTitle)}
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
          {t(languageCode, billing.pageDescription)}
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-line/90 bg-surface shadow-[0_20px_55px_-42px_rgba(24,24,23,0.5)]">
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {t(languageCode, billing.overviewTitle)}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t(languageCode, billing.overviewDescription)}
              </p>
            </div>
            <div
              className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${statusToneClass}`}
              aria-label={`${t(languageCode, billing.statusPrefix)} ${t(languageCode, billing.statusLabels[subscription.status])}`}
            >
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} aria-hidden="true" />
              {t(languageCode, billing.statusLabels[subscription.status])}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {subscription.currentPeriodEnd && (
              <div className="flex min-h-24 items-start gap-3 rounded-xl border border-line bg-background p-4">
                <span className="rounded-lg bg-brand-soft p-2 text-brand">
                  <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-secondary">
                    {t(languageCode, periodEndLabel)}
                  </p>
                  <p className="mt-1 font-mono text-base font-medium tabular-nums">
                    {formatFullDate(subscription.currentPeriodEnd, locale)}
                  </p>
                </div>
              </div>
            )}

            {trialDaysRemaining !== null && trialParts && (
              <div className="flex min-h-24 items-center rounded-xl border border-line bg-background p-4 text-sm text-text-secondary">
                <p>
                  {trialParts.before && `${trialParts.before} `}
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {trialDaysRemaining}
                  </span>{" "}
                  {trialParts.after}
                </p>
              </div>
            )}
          </div>

          {subscription.status === "none" && (
            <p className="rounded-xl border border-line bg-background p-4 text-sm text-text-secondary">
              {t(languageCode, billing.noSubscriptionOnFile)}
            </p>
          )}
        </div>

        <div className="border-t border-line bg-background/70 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex max-w-md items-start gap-3">
              <span className="rounded-lg border border-line bg-surface p-2 text-brand">
                <CreditCard size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">{t(languageCode, billing.portalTitle)}</h2>
                <p className="mt-1 text-sm leading-5 text-text-secondary">
                  {t(languageCode, billing.portalDescription)}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
                  <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
                  {t(languageCode, billing.portalSecurityNote)}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <ManageSubscriptionButton lang={languageCode} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
