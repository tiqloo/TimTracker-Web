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
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { login, onAuthStateChange, signInWithGoogle } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import {
  AuthCard,
  authButtonClass,
  authErrorClass,
  authInputClass,
  authSuccessClass,
} from "@/components/AuthCard";
import { secondaryButtonClass } from "@/lib/ui/button-styles";
import { errorFeedbackProps, successFeedbackProps } from "@/lib/ui/feedback";
import { common, login as i18nLogin, t, type Lang } from "@/lib/i18n";
import { normalizeDashboardRedirect } from "@/lib/domain/redirect-target";

// Ticket 077: renders a @fortawesome/free-brands-svg-icons icon as inline
// SVG path data — no @fortawesome/react-fontawesome dependency, same
// approach app/page.tsx's own BrandIcon already established for its
// Instagram/TikTok/LinkedIn social icons (independently defined here
// rather than shared, matching that file's own precedent of duplicating
// small brand-icon helpers per route tree rather than adding a shared
// component outside this ticket's file ownership). lucide-react (this
// project's default icon set) has no Google brand mark — confirmed by
// checking its icon list — so this is the fallback the ticket's own AK
// anticipates, using a dependency already installed for Ticket 071 rather
// than adding a new icon package for one button.
function GoogleIcon() {
  const [width, height, , , pathData] = faGoogle.icon;
  const paths = typeof pathData === "string" ? [pathData] : pathData;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="18" height="18" fill="currentColor" aria-hidden="true">
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

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
  // Ticket 077: Supabase appends `?error=...&error_description=...` to the
  // OAuth callback URL when the Google consent screen is cancelled/fails
  // (or, currently, because the provider isn't enabled — see Ticket 077's
  // "harte Voraussetzung" section). A lazy initializer, not a useEffect —
  // this must be visible on the very first render (no flash of an empty
  // error state), same reasoning `accountDeleted` above uses a plain
  // `searchParams.get()` read rather than state. Kept as `error` state
  // (not a separate variable) so it shares the existing display slot/
  // styling below and behaves like any other error once set (cleared by
  // the next submit attempt).
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("error") ? t(lang, i18nLogin.oauthError) : null,
  );
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

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

  // Ticket 077. Doesn't itself route anywhere on success — Supabase's
  // browser client performs the full-page redirect to Google internally
  // (see lib/repositories/supabase/auth.repository.ts#signInWithGoogle's
  // own comment); this only ever returns/throws for an immediate failure
  // BEFORE that redirect (e.g. "provider is not enabled"). After Google,
  // /auth/callback exchanges the PKCE code server-side and sends the browser
  // directly to the validated dashboard destination.
  async function handleGoogleSignIn() {
    setError(null);
    setGooglePending(true);
    try {
      const repos = getRepositories();
      await signInWithGoogle(repos, redirectTo);
    } catch {
      setError(t(lang, i18nLogin.oauthError));
      setGooglePending(false);
    }
  }

  return (
    <AuthCard title={t(lang, i18nLogin.title)}>
      {accountDeleted && (
        <p {...successFeedbackProps} className={`${authSuccessClass} mb-4`}>
          {t(lang, i18nLogin.accountDeleted)}
        </p>
      )}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={pending || googlePending}
        className={`${secondaryButtonClass} h-12 w-full rounded-xl gap-2.5`}
      >
        <GoogleIcon />
        {t(lang, i18nLogin.continueWithGoogle)}
      </button>
      <div className="my-6 flex items-center gap-3 text-xs font-medium text-text-secondary">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        {t(lang, i18nLogin.orDivider)}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground/80">
            {t(lang, common.email)}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending || googlePending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-medium text-foreground/80">
              {t(lang, common.password)}
            </label>
            <Link href="/reset-password" className="text-xs font-medium text-brand hover:underline">
              {t(lang, i18nLogin.forgotPassword)}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending || googlePending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </div>
        {error && <p {...errorFeedbackProps} className={authErrorClass}>{error}</p>}
        <button type="submit" disabled={pending || googlePending} className={authButtonClass}>
          {pending ? t(lang, i18nLogin.signingIn) : t(lang, i18nLogin.submit)}
        </button>
      </form>
      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-text-secondary">
        {t(lang, i18nLogin.noAccountYet)}{" "}
        <Link href="/register" className="font-semibold text-brand hover:underline">
          {t(lang, i18nLogin.registerLink)}
        </Link>
      </p>
    </AuthCard>
  );
}
