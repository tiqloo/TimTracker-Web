"use client";

// Interactive half of "Konto erstellen" — split out of
// app/(auth)/register/page.tsx (Ticket 022), same reasoning as
// components/LoginForm.tsx's module comment.
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register } from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import {
  AuthCard,
  authButtonClass,
  authErrorClass,
  authInputClass,
  authSuccessClass,
} from "@/components/AuthCard";
import { errorFeedbackProps, successFeedbackProps } from "@/lib/ui/feedback";
import { common, register as i18nRegister, t, type Lang } from "@/lib/i18n";

// A 7-day trial starts server-side automatically on signup (DB trigger,
// see supabase/migrations/0003_trial.sql in TimTracker-Starter) — nothing
// to do here for that part.
//
// Real-backend testing (2026-08-25) found the production Supabase project
// requires email confirmation before a session exists (mailer_autoconfirm:
// false — unlike local/dev seed users). register() therefore reports
// whether confirmation is still pending; only redirect straight into the
// app when it isn't.
export function RegisterForm({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t(lang, i18nRegister.passwordMismatchError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      const { emailConfirmationRequired } = await register(repos, email, password);
      if (emailConfirmationRequired) {
        setConfirmationPending(true);
        setPending(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      // Supabase's own validation messages (e.g. "Password should be at
      // least 6 characters.") are already user-friendly — shown as-is,
      // same pattern the native apps use (error.localizedDescription).
      setError(err instanceof Error ? err.message : t(lang, i18nRegister.genericError));
      setPending(false);
    }
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
          <label htmlFor="password" className="text-sm font-medium">
            {t(lang, common.password)}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
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
            disabled={pending}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={authInputClass}
          />
        </div>
        {error && <p {...errorFeedbackProps} className={authErrorClass}>{error}</p>}
        <button type="submit" disabled={pending} className={authButtonClass}>
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
