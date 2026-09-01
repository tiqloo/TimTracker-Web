"use client";

// Interactive half of "Anmelden" — split out of app/(auth)/login/page.tsx
// (Ticket 022) so the page itself can become a Server Component that
// resolves the effective UI language server-side (same
// getEffectiveLanguageCode() pattern every (dashboard)/* page uses) and
// hand it down as a prop, instead of this Client Component trying to
// read it itself (no client-side equivalent exists — see lib/i18n.ts's
// module comment). Same split rationale as components/SettingsClient.tsx/
// ProjectsClient.tsx: a Server Component does the fetch, a Client
// Component does the interactivity.
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login, onAuthStateChange } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import {
  AuthCard,
  authButtonClass,
  authErrorClass,
  authInputClass,
  authSuccessClass,
} from "@/components/AuthCard";
import { errorFeedbackProps, successFeedbackProps } from "@/lib/ui/feedback";
import { common, login as i18nLogin, t, type Lang } from "@/lib/i18n";
import { normalizeDashboardRedirect } from "@/lib/domain/redirect-target";

// useSearchParams() (for ?redirectTo=) requires a Suspense boundary
// around it for Next.js's static-render bailout, hence the wrapper below.
export function LoginForm({ lang }: { lang: Lang }) {
  return (
    <Suspense>
      <LoginFormInner lang={lang} />
    </Suspense>
  );
}

function LoginFormInner({ lang }: { lang: Lang }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(
    () => normalizeDashboardRedirect(searchParams.get("redirectTo")),
    [searchParams],
  );
  // Set by components/SettingsClient.tsx after a successful "Account
  // löschen" (Ticket 018, Phase 1e) — confirms the deletion actually
  // happened rather than silently landing back on an unremarkable login
  // form.
  const accountDeleted = searchParams.get("accountDeleted") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Supabase's signup-confirmation link (see
  // register/page.tsx's emailRedirectTo) points here because "/dashboard"
  // is a protected route (proxy.ts) unreachable before a session exists.
  // Instantiating the repos/browser client processes the confirmation
  // tokens carried in the URL automatically (@supabase/ssr's
  // detectSessionInUrl, on by default) and fires SIGNED_IN once done —
  // catch that and complete the redirect into the app ourselves, since
  // the user didn't submit the form themselves in this case.
  useEffect(() => {
    const repos = getRepositories();
    const unsubscribe = onAuthStateChange(repos, (event) => {
      if (event === "SIGNED_IN") {
        router.push(redirectTo);
        router.refresh();
      }
    });
    return unsubscribe;
  }, [redirectTo, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      await login(repos, email, password);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      // Anti-enumeration (Ticket 009 in TimTracker-Starter, same rule
      // applied here): never distinguish "wrong password" from "unknown
      // email". Supabase's own API already returns the identical
      // "Invalid login credentials" error for both (verified against the
      // real backend on 2026-08-25) — a fixed generic message is used
      // regardless, so behavior doesn't silently change if that ever
      // changes. The one exception: "email not confirmed" is safe to
      // show distinctly, since reaching it already required the correct
      // password — it isn't an oracle for whether an email is registered.
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: unknown }).code
          : undefined;
      setError(
        code === "email_not_confirmed"
          ? t(lang, i18nLogin.emailNotConfirmedError)
          : t(lang, i18nLogin.genericError),
      );
      setPending(false);
    }
  }

  return (
    <AuthCard title={t(lang, i18nLogin.title)}>
      {accountDeleted && (
        <p {...successFeedbackProps} className={`${authSuccessClass} mb-4`}>
          {t(lang, i18nLogin.accountDeleted)}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            {t(lang, common.email)}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              {t(lang, common.password)}
            </label>
            <Link href="/reset-password" className="text-xs underline">
              {t(lang, i18nLogin.forgotPassword)}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </div>
        {error && <p {...errorFeedbackProps} className={authErrorClass}>{error}</p>}
        <button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? t(lang, i18nLogin.signingIn) : t(lang, i18nLogin.submit)}
        </button>
      </form>
      <p className="mt-6 text-sm">
        {t(lang, i18nLogin.noAccountYet)}{" "}
        <Link href="/register" className="underline">
          {t(lang, i18nLogin.registerLink)}
        </Link>
      </p>
    </AuthCard>
  );
}
