import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getSubscriptionStatus } from "@/lib/application/billing";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { canUseApp } from "@/lib/domain/subscription";
import { CreateWorkspaceClient } from "@/components/CreateWorkspaceClient";
import { AccessGate } from "@/components/AccessGate";
import { workspaces as i18nWorkspaces, t } from "@/lib/i18n";

// "Unternehmens-Workspace erstellen" (Ticket 100) — same Server Component
// split as projects/page.tsx: initial language/access-gate fetch here,
// the actual form (immediate submit feedback) in a Client Component.
// Access-gated like Projects/Historie (a real feature, not an account
// management action like Settings' language/deletion) — same
// canUseApp() reused verbatim.
export default async function CreateWorkspacePage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));

  const subscription = await getSubscriptionStatus(repos);
  if (!canUseApp(subscription)) {
    return (
      <AccessGate title={t(lang, i18nWorkspaces.pageTitle)} status={subscription.status} lang={lang} />
    );
  }

  return (
    <main className="flex animate-content-fade-in flex-col gap-8 py-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-tight">{t(lang, i18nWorkspaces.pageTitle)}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          {t(lang, i18nWorkspaces.pageDescription)}
        </p>
      </div>
      <CreateWorkspaceClient lang={lang} />
    </main>
  );
}
