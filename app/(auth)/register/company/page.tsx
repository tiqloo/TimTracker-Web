import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { getWorkspaceSwitcherData } from "@/lib/application/workspace";
import { setOnboardingIntent } from "@/lib/application/auth";
import { CreateCompanyWorkspaceClient } from "@/components/CreateCompanyWorkspaceClient";
import { AuthCard } from "@/components/AuthCard";
import { companyOnboarding as i18nCompany, t } from "@/lib/i18n";

// Ticket 138 — step 2 of the "Für mein Team" registration flow (see
// components/RegistrationChoice.tsx and RegisterForm.tsx's
// defaultRedirectTo). Protected (lib/http/proxy-routing.ts) — reached
// only once a session exists, since the RPC this ultimately calls needs
// auth.uid(). Reachable after ANY of the three ways to get a session
// (immediate email/password, the email-confirmation round trip via
// LoginForm.tsx, or Google OAuth) — all three converge on this exact
// path via redirectTo="/register/company" (see
// lib/domain/redirect-target.ts's EXACT_ALLOWED_TARGETS comment).
//
// Idempotency (Ticket 138 AK: "Doppelklick/erneutes Absenden darf nicht
// mehrere identische Unternehmens-Workspaces erzeugen" and "Ein Abbruch
// ... darf kein halbfertiges oder inkonsistentes Unternehmen
// hinterlassen"): create_organization_workspace has no duplicate-name
// protection by design (Ticket 100 intentionally lets one user own
// several organization workspaces over time) — so double-submit
// protection can't live in the RPC without breaking that. It lives here
// instead: a visitor who already owns ANY organization workspace (either
// from finishing this exact step already, or from having used
// /dashboard/workspaces/new directly before) skips the form entirely and
// is sent straight into the app — covers browser-back after a successful
// submit, a reload, or opening this URL a second time.
export default async function RegisterCompanyPage() {
  const repos = await getRepositories();
  const headerList = await headers();
  const [lang, { workspaces }] = await Promise.all([
    getEffectiveLanguageCode(repos, headerList.get("accept-language")),
    getWorkspaceSwitcherData(repos),
  ]);

  if (workspaces.some((workspace) => workspace.workspaceType === "ORGANIZATION")) {
    // Ticket 164: also the natural place to clear a leftover
    // onboarding_intent (e.g. the user finished via a different tab, or
    // created a company through /dashboard/workspaces/new instead) —
    // otherwise a stale flag would keep sending them back here forever.
    await setOnboardingIntent(repos, null).catch(() => {});
    redirect("/dashboard/get-started");
  }

  // Ticket 164: idempotent — landing here again (a second tab, a reload,
  // resuming after closing the browser) just sets the same value again.
  // Cleared on success or explicit skip in CreateCompanyWorkspaceClient.
  await setOnboardingIntent(repos, "organization").catch(() => {});

  return (
    <AuthCard title={t(lang, i18nCompany.pageTitle)}>
      <p className="mb-6 text-sm leading-6 text-text-secondary">{t(lang, i18nCompany.pageDescription)}</p>
      <CreateCompanyWorkspaceClient lang={lang} />
    </AuthCard>
  );
}
