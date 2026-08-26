"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
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

const GENERIC_LOGIN_ERROR = "E-Mail oder Passwort ist falsch.";

// useSearchParams() (for ?redirectTo=) requires a Suspense boundary
// around it for Next.js's static-render bailout, hence the wrapper below.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          ? "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungsmail)."
          : GENERIC_LOGIN_ERROR,
      );
      setPending(false);
    }
  }

  return (
    <AuthCard title="Anmelden">
      {accountDeleted && (
        <p className={`${authSuccessClass} mb-4`}>
          Dein Account wurde erfolgreich gelöscht.
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            E-Mail
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
              Passwort
            </label>
            <Link href="/reset-password" className="text-xs underline">
              Passwort vergessen?
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
        {error && <p className={authErrorClass}>{error}</p>}
        <button type="submit" disabled={pending} className={authButtonClass}>
          {pending ? "Wird angemeldet…" : "Anmelden"}
        </button>
      </form>
      <p className="mt-6 text-sm">
        Noch kein Konto?{" "}
        <Link href="/register" className="underline">
          Registrieren
        </Link>
      </p>
    </AuthCard>
  );
}
