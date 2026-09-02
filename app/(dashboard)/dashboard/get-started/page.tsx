import Link from "next/link";
import { headers } from "next/headers";
import { Check, Circle, Download, Laptop, RefreshCw, UserRoundCheck } from "lucide-react";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { getProfile } from "@/lib/application/auth";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEntriesForRange, isoToday } from "@/lib/application/dashboard";
import { getPublicMacosRelease } from "@/lib/domain/macos-release";
import { onboarding, t, type Lang } from "@/lib/i18n";

function daysRemaining(periodEnd: string | null): number | null {
  if (!periodEnd) return null;
  return Math.max(0, Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86_400_000));
}

function Step({
  complete,
  icon: Icon,
  title,
  children,
  lang,
}: {
  complete: boolean;
  icon: typeof Download;
  title: string;
  children: React.ReactNode;
  lang: Lang;
}) {
  return (
    <li className="relative grid gap-4 rounded-2xl border border-line/90 bg-surface p-5 shadow-[0_16px_46px_-38px_rgba(24,24,23,0.45)] sm:grid-cols-[auto_1fr_auto] sm:items-start sm:p-6">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${complete ? "bg-emerald-50 text-emerald-700" : "bg-brand-soft text-brand"}`}>
        <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="font-semibold tracking-[-0.01em]">{title}</h2>
        <div className="mt-1.5 text-sm leading-6 text-text-secondary">{children}</div>
      </div>
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${complete ? "bg-emerald-50 text-emerald-700" : "bg-paper text-text-secondary"}`}>
        {complete ? <Check size={14} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}
        {t(lang, complete ? onboarding.done : onboarding.next)}
      </span>
    </li>
  );
}

export default async function GetStartedPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const [lang, profile, subscription] = await Promise.all([
    getEffectiveLanguageCode(repos, headerList.get("accept-language")),
    getProfile(repos),
    getSubscriptionStatus(repos),
  ]);
  const today = isoToday();
  const entries = await getEntriesForRange(repos, profile.createdAt.slice(0, 10), today);
  const hasSyncedEntry = entries.length > 0;
  const release = getPublicMacosRelease();
  const remaining = daysRemaining(subscription.currentPeriodEnd);
  const completedSteps = 1 + (hasSyncedEntry ? 3 : 0);

  return (
    <main className="flex animate-content-fade-in flex-col gap-7 py-8 sm:py-10">
      <header className="max-w-3xl">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-brand">{t(lang, onboarding.eyebrow)}</p>
        <h1 className="text-[34px] font-semibold tracking-[-0.035em] sm:text-[40px]">{t(lang, onboarding.title)}</h1>
        <p className="mt-3 text-base leading-7 text-text-secondary">{t(lang, onboarding.intro)}</p>
      </header>

      <section aria-label={t(lang, onboarding.progress)} className="rounded-2xl border border-brand/15 bg-brand-soft/55 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 text-sm font-medium">
          <span>{t(lang, onboarding.progress)}</span>
          <span>{completedSteps}/4</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completedSteps}>
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${completedSteps * 25}%` }} />
        </div>
        {remaining !== null && (
          <p className="mt-3 text-sm text-text-secondary">
            {t(lang, onboarding.trialPrefix)} <strong className="text-foreground">{remaining}</strong> {t(lang, onboarding.trialSuffix)}
          </p>
        )}
      </section>

      <ol className="grid gap-4">
        <Step complete icon={UserRoundCheck} title={t(lang, onboarding.accountTitle)} lang={lang}>
          {t(lang, onboarding.accountBody)} <strong className="break-all text-foreground">{profile.email}</strong>
        </Step>
        <Step complete={hasSyncedEntry} icon={Download} title={t(lang, onboarding.downloadTitle)} lang={lang}>
          <p>{t(lang, onboarding.downloadBody)}</p>
          {release ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href={release.downloadUrl} className="inline-flex rounded-xl bg-brand px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand/90">
                {t(lang, onboarding.downloadAction)}
              </a>
              <span>v{release.version} · macOS {release.minimumMacos}+</span>
            </div>
          ) : (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900">{t(lang, onboarding.downloadUnavailable)}</p>
          )}
        </Step>
        <Step complete={hasSyncedEntry} icon={Laptop} title={t(lang, onboarding.installTitle)} lang={lang}>
          {t(lang, onboarding.installBody)} <strong className="break-all text-foreground">{profile.email}</strong>
        </Step>
        <Step complete={hasSyncedEntry} icon={hasSyncedEntry ? Check : RefreshCw} title={t(lang, onboarding.syncTitle)} lang={lang}>
          {t(lang, hasSyncedEntry ? onboarding.syncDone : onboarding.syncPending)}
        </Step>
      </ol>

      <Link href="/dashboard" className="w-fit rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-paper">
        {t(lang, onboarding.openToday)} →
      </Link>
    </main>
  );
}
