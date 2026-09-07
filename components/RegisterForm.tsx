"use client";

// Interactive half of "Konto erstellen" — split out of
// app/(auth)/register/page.tsx (Ticket 022), same reasoning as
// components/LoginForm.tsx's module comment.
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { EmailAlreadyRegisteredError, register, signInWithGoogle } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import {
  AuthCard,
  authButtonClass,
  authErrorClass,
  authInputClass,
  authSuccessClass,
} from "@/components/AuthCard";
import { secondaryButtonClass } from "@/lib/ui/button-styles";
import { errorFeedbackProps, successFeedbackProps, warningFeedbackProps } from "@/lib/ui/feedback";
import { common, register as i18nRegister, t, type Lang } from "@/lib/i18n";
import { normalizeDashboardRedirect } from "@/lib/domain/redirect-target";

// Ticket 077: same inline-SVG BrandIcon approach as LoginForm.tsx's own
// GoogleIcon — see that file's comment for the full reasoning (no
// @fortawesome/react-fontawesome dependency, no lucide-react Google mark
// available, duplicated locally per this project's existing per-route
// brand-icon precedent rather than shared across files outside this
// ticket's ownership).
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

// Ticket 074. Verified LIVE against the local Docker Supabase stack
// (2026-09-02): signUp() with a 5-character password fails with
// error_code "weak_password" ("Password should be at least 6
// characters."), a 6-character password succeeds — matching the value the
// pre-existing code comment already cited (see the try/catch below). Not
// re-verified against the production project in this session (this repo's
// .env.local points at the local stack, not production, per README.md's
// "lokal gegen Docker (Standard)" policy) — if production's configured
// minimum has since drifted from the local stack's, this client-side gate
// would be wrong in one direction or the other; Supabase's own server-side
// error remains the fallback either way (see the try/catch below), so a
// drift fails safe rather than silently.
const MIN_PASSWORD_LENGTH = 6;

// A 7-day trial starts server-side automatically on signup (DB trigger,
// see supabase/migrations/0003_trial.sql in TimTracker-Starter) — nothing
// to do here for that part.
//
// Real-backend testing (2026-08-25) found the production Supabase project
// requires email confirmation before a session exists (mailer_autoconfirm:
// false — unlike local/dev seed users). register() therefore reports
// whether confirmation is still pending; only redirect straight into the
// app when it isn't.
// Ticket 102: `prefillEmail` (from the invited email, via
// app/(auth)/register/page.tsx's `?email=`) only ever sets the field's
// initial value — it stays a perfectly normal, freely editable input
// afterwards. A visitor who arrived from an invitation link but wants to
// register a different address is not blocked from doing so.
//
// useSearchParams() (for ?redirectTo=) requires a Suspense boundary around
// it for Next.js's static-render bailout — same wrapper LoginForm.tsx uses.
export function RegisterForm({ lang, prefillEmail }: { lang: Lang; prefillEmail?: string }) {
  return (
    <Suspense>
      <RegisterFormInner lang={lang} prefillEmail={prefillEmail} />
    </Suspense>
  );
}

function RegisterFormInner({ lang, prefillEmail }: { lang: Lang; prefillEmail?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Ticket 102: was hardcoded to "/dashboard/get-started" before this
  // param existed — passing that same string through normalizeDashboardRedirect
  // when ?redirectTo= is absent reproduces the exact previous default
  // (it matches the "/dashboard/*" prefix rule), so ordinary registration
  // is unaffected. A present-but-invalid value falls back to "/dashboard"
  // instead, same as every other normalizeDashboardRedirect caller.
  const redirectTo = normalizeDashboardRedirect(searchParams.get("redirectTo") ?? "/dashboard/get-started");
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  // Live, during-typing feedback (Ticket 074) — computed straight from
  // state each render rather than a separate effect, same "derive, don't
  // duplicate" approach the mismatch check below relies on. Only shown
  // once the user has actually typed something, so the field doesn't open
  // with a warning already showing.
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t(lang, i18nRegister.passwordTooShortError));
      return;
    }

    if (password !== confirmPassword) {
      setError(t(lang, i18nRegister.passwordMismatchError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const { emailConfirmationRequired } = await register(repos, email, password, redirectTo);
      if (emailConfirmationRequired) {
        setConfirmationPending(true);
        setPending(false);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      // Ticket 074: a dedicated card (see below), not the generic error
      // message — the "already registered" case needs its own copy plus a
      // path forward (login / reset password), not just an inline error
      // string next to the form.
      if (err instanceof EmailAlreadyRegisteredError) {
        setEmailAlreadyRegistered(true);
        setPending(false);
        return;
      }
      // Supabase's own validation messages (e.g. "Password should be at
      // least 6 characters.") are already user-friendly — shown as-is,
      // same pattern the native apps use (error.localizedDescription).
      // Kept as a fallback even though the client-side check above should
      // normally prevent a too-short password from reaching the server at
      // all — see MIN_PASSWORD_LENGTH's own comment on why that gate
      // could theoretically drift from the server's actual policy.
      setError(err instanceof Error ? err.message : t(lang, i18nRegister.genericError));
      setPending(false);
    }
  }

  // Ticket 077. Same redirect target as this form's own email-confirmation
  // flow above (register()'s emailRedirectTo) — Supabase treats OAuth
  // sign-in/sign-up identically, so "registering" with Google is the same
  // call as LoginForm's Google button. The server-side PKCE callback sends
  // a newly authenticated user to `redirectTo` (Ticket 102: the onboarding
  // page by default, or back to a pending workspace invitation).
  async function handleGoogleSignIn() {
    setError(null);
    setGooglePending(true);
    try {
      const repos = getRepositories();
      await signInWithGoogle(repos, redirectTo);
    } catch {
      setError(t(lang, i18nRegister.oauthError));
      setGooglePending(false);
    }
  }

  if (emailAlreadyRegistered) {
    return (
      <AuthCard title={t(lang, i18nRegister.emailAlreadyRegisteredTitle)}>
        <p {...errorFeedbackProps} className={authErrorClass}>
          {t(lang, i18nRegister.emailAlreadyRegisteredBody)}
        </p>
        <p className="mt-4 flex flex-col gap-2 text-sm">
          <Link href="/login" className="underline">
            {t(lang, i18nRegister.goToLogin)}
          </Link>
          <Link href="/reset-password" className="underline">
            {t(lang, i18nRegister.resetPasswordLink)}
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (confirmationPending) {
    return (
      <AuthCard title={t(lang, i18nRegister.almostDoneTitle)}>
        <p {...successFeedbackProps} className={authSuccessClass}>{t(lang, i18nRegister.confirmationSentBody)}</p>
        <p className="mt-4 text-sm">
          <Link href="/login" className="underline">
            {t(lang, i18nRegister.goToLogin)}
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t(lang, i18nRegister.title)}>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={pending || googlePending}
        className={`${secondaryButtonClass} h-12 w-full rounded-xl gap-2.5`}
      >
        <GoogleIcon />
        {t(lang, i18nRegister.continueWithGoogle)}
      </button>
      <div className="my-6 flex items-center gap-3 text-xs font-medium text-text-secondary">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        {t(lang, i18nRegister.orDivider)}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
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
            disabled={pending || googlePending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            {t(lang, common.password)}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending || googlePending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
          {passwordTooShort && (
            // text-red-700/text-red-400 (not text-danger) for the actual
            // text color — same reasoning as authErrorClass/errorMessageClass
            // (lib/ui/status-styles.ts): --danger alone is under the AA text
            // contrast ratio (documented in app/globals.css), so it's only
            // used for background/border tints, never text color.
            <p {...warningFeedbackProps} className="text-xs text-red-700 dark:text-red-400">
              {t(lang, i18nRegister.passwordMinLengthHint)}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            {t(lang, i18nRegister.passwordConfirm)}
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending || googlePending}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={authInputClass}
          />
        </div>
        {error && <p {...errorFeedbackProps} className={authErrorClass}>{error}</p>}
        <button type="submit" disabled={pending || googlePending} className={authButtonClass}>
          {pending ? t(lang, i18nRegister.creating) : t(lang, i18nRegister.submit)}
        </button>
      </form>
      <p className="mt-6 text-sm">
        {t(lang, i18nRegister.alreadyHaveAccount)}{" "}
        <Link href="/login" className="underline">
          {t(lang, i18nRegister.loginLink)}
        </Link>
      </p>
    </AuthCard>
  );
}
