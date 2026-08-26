"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  onAuthStateChange,
  requestPasswordReset,
  updatePassword,
} from "@/lib/application/auth";
import { getRepositories } from "@/lib/application/client";
import {
  AuthCard,
  authButtonClass,
  authErrorClass,
  authInputClass,
  authSuccessClass,
} from "@/components/AuthCard";

// This page (closing Ticket 009's last gap, per TimTracker-Starter) has
// two jobs depending on how it's reached:
//  a) Directly, e.g. from the "Passwort vergessen?" link on /login — show
//     a form asking for an email, then a generic anti-enumeration success
//     message (never confirms/denies whether that address is registered).
//  b) Via the actual link from the reset email — Supabase's browser
//     client establishes a temporary recovery session and fires a
//     PASSWORD_RECOVERY auth event, which is the ONLY reliable way to
//     detect this case (there's no query param to read — Supabase's
//     tokens are consumed automatically into a session before this code
//     ever runs). Switch to a "set new password" form when that fires.
type Mode = "requestReset" | "setNewPassword";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("requestReset");

  useEffect(() => {
    const repos = getRepositories();
    const unsubscribe = onAuthStateChange(repos, (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("setNewPassword");
      }
    });
    return unsubscribe;
  }, []);

  // --- Mode a: request a reset link ---
  const [email, setEmail] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [requestPending, setRequestPending] = useState(false);

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    setRequestPending(true);
    try {
      const repos = getRepositories();
      await requestPasswordReset(repos, email);
      // Always the same message on success, regardless of whether the
      // address is actually registered — Supabase's API itself already
      // behaves this way (verified against the real backend on
      // 2026-08-25: an unknown address gets an identical 200 response).
      setRequestSent(true);
    } catch (err) {
      // A genuine error here (rate limit, network, malformed address)
      // doesn't leak whether the email exists, so it's safe to show
      // as-is — only the SUCCESS path is deliberately made generic.
      setRequestError(
        err instanceof Error ? err.message : "Anfrage fehlgeschlagen.",
      );
    } finally {
      setRequestPending(false);
    }
  }

  // --- Mode b: set a new password ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updatePending, setUpdatePending] = useState(false);

  async function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdateError(null);

    if (newPassword !== confirmNewPassword) {
      setUpdateError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setUpdatePending(true);
    try {
      const repos = getRepositories();
      await updatePassword(repos, newPassword);
      // Supabase's recovery session becomes a normal authenticated
      // session once the password is updated — go straight to the
      // dashboard, same as a successful login. Old sessions/tokens are
      // invalidated server-side by Supabase (already confirmed for the
      // native apps, Ticket 009).
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : "Passwort konnte nicht gesetzt werden.",
      );
      setUpdatePending(false);
    }
  }

  if (mode === "setNewPassword") {
    return (
      <AuthCard title="Neues Passwort setzen">
        <form onSubmit={handleUpdateSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="newPassword" className="text-sm font-medium">
              Neues Passwort
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={updatePending}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={authInputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="confirmNewPassword" className="text-sm font-medium">
              Neues Passwort bestätigen
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={updatePending}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className={authInputClass}
            />
          </div>
          {updateError && <p className={authErrorClass}>{updateError}</p>}
          <button type="submit" disabled={updatePending} className={authButtonClass}>
            {updatePending ? "Wird gespeichert…" : "Passwort speichern"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Passwort zurücksetzen">
      {requestSent ? (
        <p className={authSuccessClass}>
          Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail
          zum Zurücksetzen des Passworts verschickt.
        </p>
      ) : (
        <form onSubmit={handleRequestSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={requestPending}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
            />
          </div>
          {requestError && <p className={authErrorClass}>{requestError}</p>}
          <button type="submit" disabled={requestPending} className={authButtonClass}>
            {requestPending ? "Wird gesendet…" : "Link zum Zurücksetzen senden"}
          </button>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="underline">
          Zurück zum Login
        </Link>
      </p>
    </AuthCard>
  );
}
