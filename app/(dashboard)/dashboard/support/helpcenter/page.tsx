import Link from "next/link";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { helpcenter, t } from "@/lib/i18n";

// "Helpcenter" (Ticket 030, TimTracker-Starter repo) — static FAQ page,
// footer link from /dashboard/support. Plain Server Component, no
// interactivity, no data fetch beyond the language preference: every
// question/answer pair lives in lib/i18n.ts's `helpcenter` namespace,
// each grounded in an already-shipped feature (see that namespace's own
// comment for exactly which). Same no canUseApp()-gate reasoning as
// support/page.tsx — help content stays reachable regardless of
// subscription state.
export default async function HelpcenterPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  return (
    <main className="flex animate-content-fade-in flex-col gap-6 py-8">
      <Link href="/dashboard/support" className="text-sm text-foreground/70 hover:text-foreground">
        {t(lang, helpcenter.backToSupport)}
      </Link>
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, helpcenter.pageTitle)}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t(lang, helpcenter.intro)}</p>
      </div>
      <dl className="flex flex-col divide-y divide-line border-t border-line">
        {helpcenter.faqs.map((faq) => (
          <div key={faq.question.de} className="flex flex-col gap-1.5 py-4">
            <dt className="text-sm font-medium">{t(lang, faq.question)}</dt>
            <dd className="text-sm text-foreground/70">{t(lang, faq.answer)}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
