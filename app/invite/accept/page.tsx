import { headers } from "next/headers";
import Link from "next/link";
import { getRepositories } from "@/lib/application/server";
import { getEffectiveLanguageCode } from "@/lib/application/language";
import { getProfile } from "@/lib/application/auth";
import { previewWorkspaceInvitation } from "@/lib/application/workspace";
import { AuthCard, authButtonClass } from "@/components/AuthCard";
import { secondaryButtonClass } from "@/lib/ui/button-styles";
import { AcceptInvitationClient } from "@/components/AcceptInvitationClient";
import { acceptInvite as i18nAcceptInvite, t } from "@/lib/i18n";

// "Workspace-Einladung annehmen" (Ticket 102) — a public route (NOT under
// the (dashboard) route group, which requires an active session/
// subscription): a brand-new, not-yet-registered visitor must be able to
// land here straight from an invitation link with no session at all. Same
// AuthCard shell as login/register/reset-password for visual consistency
// with every other pre-dashboard page.
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const repos = await getRepositories();
  const headerList = await headers();
  const lang = await getEffectiveLanguageCode(repos, headerList.get("accept-language"));
  const title = t(lang, i18nAcceptInvite.pageTitle);

  if (!token) {
    return (
      <AuthCard title={title}>
        <p>{t(lang, i18nAcceptInvite.invalidDescription)}</p>
      </AuthCard>
    );
  }

  let preview: Awaited<ReturnType<typeof previewWorkspaceInvitation>> | null = null;
  try {
    preview = await previewWorkspaceInvitation(repos, token);
  } catch {
    preview = null;
  }

  if (!preview || !preview.isValid) {
    return (
      <AuthCard title={title}>
        <p>{t(lang, i18nAcceptInvite.invalidDescription)}</p>
      </AuthCard>
    );
  }

  const userId = await repos.auth.getAuthenticatedUserId();
  const roleLabel = t(lang, preview.role === "admin" ? i18nAcceptInvite.roleAdmin : i18nAcceptInvite.roleMember);
  const invitationSummary = (
    <p className="text-sm text-foreground/70">
      <strong>{preview.workspaceName}</strong> — {t(lang, i18nAcceptInvite.invitedAs)}{" "}
      <strong>{preview.email}</strong> ({roleLabel})
    </p>
  );

  if (!userId) {
    // Ticket 102's "existing vs. brand-new user" flow: both destinations
    // carry `redirectTo`/`email` so the login/register pages can bring the
    // visitor straight back here (login) or pre-fill the invited email
    // (register) — see lib/domain/redirect-target.ts's EXACT_ALLOWED_TARGETS
    // for why `/invite/accept` specifically is allow-listed for the login
    // redirect.
    const redirectTarget = `/invite/accept?token=${encodeURIComponent(token)}`;
    const loginHref = `/login?redirectTo=${encodeURIComponent(redirectTarget)}`;
    const registerHref = `/register?email=${encodeURIComponent(preview.email)}&redirectTo=${encodeURIComponent(redirectTarget)}`;
    return (
      <AuthCard title={title}>
        <div className="flex flex-col gap-4">
          {invitationSummary}
          <p className="text-sm text-foreground/70">{t(lang, i18nAcceptInvite.needAccountDescription)}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={loginHref} className={authButtonClass}>
              {t(lang, i18nAcceptInvite.loginButton)}
            </Link>
            <Link href={registerHref} className={secondaryButtonClass}>
              {t(lang, i18nAcceptInvite.registerButton)}
            </Link>
          </div>
          <p className="text-xs text-foreground/50">{t(lang, i18nAcceptInvite.registerHint)}</p>
        </div>
      </AuthCard>
    );
  }

  const profile = await getProfile(repos);
  if (profile.email.toLowerCase() !== preview.email.toLowerCase()) {
    return (
      <AuthCard title={t(lang, i18nAcceptInvite.wrongAccountTitle)}>
        <div className="flex flex-col gap-4">
          {invitationSummary}
          <p className="text-sm text-foreground/70">{t(lang, i18nAcceptInvite.wrongAccountDescription)}</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={title}>
      <div className="flex flex-col gap-4">
        {invitationSummary}
        <AcceptInvitationClient token={token} lang={lang} />
      </div>
    </AuthCard>
  );
}
