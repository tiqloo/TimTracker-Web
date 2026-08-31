"use client";

// Interactive half of "Einstellungen" (Ticket 018, Phase 1e): the
// language picker and the "Account löschen" confirmation flow. A Client
// Component for the same reason ProjectsClient.tsx is — both actions need
// immediate feedback, no full page reload. Gets its Repositories instance
// from lib/application/client.ts (the designated exception, see
// CLAUDE.md's "Resolved 2026-08-25" entry) and calls straight into
// lib/application/language.ts / lib/application/auth.ts — never
// lib/repositories/* directly.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getRepositories } from "@/lib/application/client";
import { setLanguagePreference, type AppLanguage } from "@/lib/application/language";
import { deleteAccount, logout } from "@/lib/application/auth";
import { APP_LANGUAGES, languageDisplayName } from "@/lib/domain/language";

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

const buttonClass =
  "rounded-md border border-line px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";

const errorClass =
  "rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400";

const DELETE_CONFIRMATION_WORD = "LÖSCHEN";

export function SettingsClient({ initialLanguage }: { initialLanguage: AppLanguage }) {
  return (
    <div className="flex flex-col gap-10">
      <LanguageSection initialLanguage={initialLanguage} />
      <DeleteAccountSection />
    </div>
  );
}

function LanguageSection({ initialLanguage }: { initialLanguage: AppLanguage }) {
  const router = useRouter();
  const [language, setLanguage] = useState(initialLanguage);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: AppLanguage) {
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      await setLanguagePreference(repos, next);
      setLanguage(next);
      // Refetches the current route's Server Component tree (root layout
      // included) against the now-updated cookie — this is what actually
      // moves <html lang> and this app's own Intl-based date formatting
      // (settings/billing) over to the new value. See
      // lib/domain/language.ts's SCOPE NOTE: it does NOT retranslate any
      // UI text, there is none wired to this preference yet.
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sprache konnte nicht gespeichert werden.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground/70">Sprache</h2>
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Sprache">
        {APP_LANGUAGES.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 text-sm"
          >
            <input
              type="radio"
              name="language"
              value={option}
              checked={language === option}
              disabled={pending}
              onChange={() => handleChange(option)}
            />
            {languageDisplayName(option)}
          </label>
        ))}
      </div>
      <p className="text-xs text-foreground/60">
        Wirkt sofort auf die Seitensprache (<code>&lt;html lang&gt;</code>) und die
        Datumsformate auf dieser und der Abo-Seite. Die Texte der Anwendung selbst
        (Heute, Historie, Projekte, …) sind aktuell ausschließlich auf Deutsch —
        vollständige Zweisprachigkeit ist bewusst nicht Teil dieser Phase (siehe
        Ticket 018, Phase 1e).
      </p>
      {error && <p className={errorClass}>{error}</p>}
    </section>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const canConfirm = confirmationText.trim() === DELETE_CONFIRMATION_WORD;

  async function handleDelete() {
    if (!canConfirm) return;
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      await deleteAccount(repos);
      // The account (and with it, the session's underlying auth.users
      // row) is already gone server-side at this point — logout() still
      // clears the local session state the browser client is holding, so
      // proxy.ts's session check on the next request behaves exactly like
      // any other signed-out visit rather than holding a token for a user
      // that no longer exists.
      await logout(repos);
      router.push("/login?accountDeleted=1");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Konto konnte nicht gelöscht werden.",
      );
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-red-600/30 p-5">
      <h2 className="text-sm font-medium text-red-700 dark:text-red-400">
        Account löschen
      </h2>
      <p className="text-sm text-foreground/70">
        Löscht deinen Account unwiderruflich, inklusive aller Cloud-Daten (Projekte,
        Zeiteinträge, Abo). Lokale Daten auf deinen Geräten bleiben unangetastet.
        Diese Aktion kann nicht rückgängig gemacht werden.
      </p>

      {!confirming ? (
        <div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={dangerButtonClass}
          >
            Account löschen…
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="delete-confirm" className="text-sm">
            Gib <span className="font-semibold">{DELETE_CONFIRMATION_WORD}</span> ein, um
            zu bestätigen:
          </label>
          <input
            id="delete-confirm"
            type="text"
            disabled={pending}
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className={inputClass}
            autoComplete="off"
          />
          {error && <p className={errorClass}>{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canConfirm || pending}
              className={dangerButtonClass}
            >
              {pending ? "Wird gelöscht…" : "Endgültig löschen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setConfirmationText("");
                setError(null);
              }}
              disabled={pending}
              className={buttonClass}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
