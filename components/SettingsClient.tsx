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
import { useToast } from "@/components/ToastProvider";
import { getRepositories } from "@/lib/application/client";
import { setLanguagePreference, type AppLanguage } from "@/lib/application/language";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  logout,
  updateDisplayName,
  EmailAlreadyInUseError,
  ReauthenticationFailedError,
  type Profile,
} from "@/lib/application/auth";
import { APP_LANGUAGES, languageCodeToLocale, languageDisplayName } from "@/lib/domain/language";
import { normalizeDisplayNameInput } from "@/lib/domain/profile";
import { formatFullDate } from "@/lib/format";
import {
  common,
  emailChangeSuccessMessage,
  profile as i18nProfile,
  settings,
  t,
  type Lang,
} from "@/lib/i18n";

const inputClass =
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

const buttonClass =
  "rounded-md border border-line px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";

const errorClass =
  "rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400";

export function SettingsClient({
  initialLanguage,
  profile,
  lang,
}: {
  initialLanguage: AppLanguage;
  profile: Profile;
  lang: Lang;
}) {
  return (
    <div className="flex flex-col gap-10">
      <ProfileSection profile={profile} lang={lang} />
      <LanguageSection initialLanguage={initialLanguage} lang={lang} />
      <DataExportSection lang={lang} />
      <DeleteAccountSection lang={lang} />
    </div>
  );
}

// "Meine Daten exportieren" (Ticket 046, TimTracker-Starter repo) — DSGVO/
// GDPR Art. 20 data-portability action, the direct complement to
// DeleteAccountSection's Art. 17 deletion right just below — placed
// immediately above it, same "Konto-Grundrechte" grouping the ticket's
// own "Ausgangslage" calls for, without otherwise restructuring this
// file's section order (that's Ticket 041's job).
//
// The actual export is a plain server-rendered Route Handler
// (app/(dashboard)/dashboard/settings/export/data/route.ts) returning a
// downloadable JSON file, same "one Route Handler, no client-side
// assembly" shape as the existing CSV/PDF export routes. Unlike those
// (plain <a href> links, no loading/error feedback needed there), this
// button goes through fetch() + a pending state + useToast() — the
// brief for this ticket explicitly asks for the same success/error toast
// treatment every other action in this file already has (Ticket 042),
// which a plain same-origin navigation link can't give: a failed
// same-origin navigation would just render an error page instead of a
// toast the user stays on this page to read.
function DataExportSection({ lang }: { lang: Lang }) {
  const { showSuccess, showError } = useToast();
  const [pending, setPending] = useState(false);

  async function handleExport() {
    setPending(true);
    try {
      const response = await fetch("/dashboard/settings/export/data");
      if (!response.ok) {
        throw new Error(t(lang, settings.dataExportError));
      }
      const blob = await response.blob();
      // Same filename convention the route itself sets in its
      // Content-Disposition header — duplicated here only as the
      // fallback a browser would rarely need (the `download` attribute
      // below is what browsers actually honor first for a same-origin
      // blob: URL).
      const filenameMatch = response.headers
        .get("Content-Disposition")
        ?.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] ?? "TimTracker-Datenexport.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showSuccess(t(lang, settings.dataExportSuccess));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, settings.dataExportError));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-5">
      <h2 className="text-sm font-medium text-foreground/70">
        {t(lang, settings.dataExportTitle)}
      </h2>
      <p className="text-sm text-foreground/70">{t(lang, settings.dataExportBody)}</p>
      <div>
        <button
          type="button"
          onClick={handleExport}
          disabled={pending}
          className={buttonClass}
        >
          {pending ? t(lang, settings.dataExportPending) : t(lang, settings.dataExportButton)}
        </button>
      </div>
    </section>
  );
}

// "Profil" (Ticket 024, TimTracker-Starter repo) — editable display name
// plus the two read-only account fields (email, account-creation date).
// Placed above LanguageSection per the ticket's AK. Same Client Component
// + pending state shape as LanguageSection/DeleteAccountSection below:
// optimistic local state update on success, then router.refresh() so
// DashboardNav (which resolves the profile server-side in
// app/(dashboard)/layout.tsx) picks up the new value too — same reasoning
// LanguageSection's own comment gives for why it calls router.refresh()
// after already updating its own state locally.
//
// Ticket 042: used to show `saved && ...` as inline text next to the
// button (the ticket's own motivating example of the old ad hoc pattern)
// and an inline errorClass block below the field. Both now go through
// useToast() instead — success auto-dismisses, error stays until closed.
// There's no separate blocking field validation here (display name is
// optional, no client-side format check), so unlike ProjectsClient.tsx's
// forms there's no inline error case left at all.
function ProfileSection({ profile, lang }: { profile: Profile; lang: Lang }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const repos = getRepositories();
      await updateDisplayName(repos, displayName);
      // Mirrors what the save just persisted (trim, empty -> "") rather
      // than re-fetching — same optimistic-update pattern LanguageSection
      // uses, see its own comment.
      setDisplayName(normalizeDisplayNameInput(displayName) ?? "");
      showSuccess(t(lang, common.saved));
      router.refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nProfile.displayNameSaveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line p-5">
      <h2 className="text-sm font-medium text-foreground/70">
        {t(lang, i18nProfile.sectionTitle)}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-display-name" className="text-sm font-medium">
            {t(lang, i18nProfile.displayNameLabel)}{" "}
            <span className="font-normal text-foreground/50">
              ({t(lang, i18nProfile.displayNameOptionalHint)})
            </span>
          </label>
          <input
            id="profile-display-name"
            type="text"
            autoComplete="name"
            disabled={pending}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? t(lang, common.saving) : t(lang, common.save)}
          </button>
        </div>
      </form>
      <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-foreground/60">{t(lang, i18nProfile.emailLabel)}</dt>
          <dd className="truncate">{profile.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-foreground/60">{t(lang, i18nProfile.createdAtLabel)}</dt>
          <dd className="font-mono tabular-nums">
            {formatFullDate(profile.createdAt, languageCodeToLocale(lang))}
          </dd>
        </div>
      </dl>
      {/* Ticket 032: EmailChangeAction/PasswordChangeAction get a visually
          distinct "security-sensitive" treatment — a subtle --paper-token
          background tint plus a small "Sicherheit"/"Security" subtitle —
          so a routine display-name edit above no longer reads with the
          same visual weight as changing account email/password.
          Deliberately NOT red/destructive styling: that stays exclusive to
          DeleteAccountSection below, see this component's Ticket 032
          comment there for why. */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          {t(lang, i18nProfile.securitySectionTitle)}
        </h3>
        <EmailChangeAction profile={profile} lang={lang} />
        <PasswordChangeAction lang={lang} />
      </div>
    </section>
  );
}

// "E-Mail-Adresse ändern" (Ticket 025, TimTracker-Starter repo — direct
// follow-up to 024's read-only email field). Lives inside ProfileSection's
// card per the ticket's AK ("Neues Feld/Aktion im 'Profil'-Abschnitt"), but
// as its own component so its form/pending/error state doesn't tangle with
// the display-name form above it. Same two-step-reveal convention as
// DeleteAccountSection below (a button first, the form only after it's
// clicked) rather than showing the form unconditionally.
//
// Deliberately does NOT update `profile.email`/call router.refresh() on
// success, unlike ProfileSection's own save above — Supabase's "secure
// email change" (double confirm, verified ON for this project) means the
// OLD address stays the account's real, active email until BOTH
// confirmation links are clicked (see changeEmail's port doc), so
// optimistically showing the new address here would show a change that
// hasn't actually happened yet. Only a persistent text confirmation is
// shown instead — see `sentTo` below.
//
// Ticket 042 explicitly left this success message (and PasswordChangeAction's
// below) as a persistent inline block, NOT a toast, despite converting
// every other success message in this file. Reasoning: a toast is
// transient by design — it auto-dismisses in a few seconds and is gone.
// `sentTo`'s message names the exact old/new addresses and says the
// change only takes effect once BOTH confirmation emails are clicked —
// exactly the "would a toast lose important context" case the ticket
// calls out, and Ticket 025's own reasoning (this comment block above)
// already established that this message needs to survive the form
// collapsing back down, i.e. outlive a single render pass, let alone a
// 4-second auto-dismiss timer. A user who glances away for a moment and
// looks back at Settings later should still see it. PasswordChangeAction's
// `succeeded` message is kept consistent with this same treatment even
// though its own action does take effect immediately (no email
// confirmation) — both live inside the same "Sicherheit" box, and having
// one security action confirm via toast and the other via a persistent
// block would reintroduce exactly the kind of per-component inconsistency
// this ticket exists to remove. Blocking field validation (e.g.
// PasswordChangeAction's "Passwörter stimmen nicht überein" mismatch
// check) and request-failure errors on both actions also stay inline via
// errorClass, unchanged — same call, since a wrong-password/already-
// registered error is exactly the kind of message a user re-reads while
// fixing the form, not a fire-and-forget confirmation.
function EmailChangeAction({ profile, lang }: { profile: Profile; lang: Lang }) {
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The addresses of the last successfully SENT request (not necessarily
  // confirmed/applied yet) — kept so the success message can name them
  // even after the form collapses back down.
  const [sentTo, setSentTo] = useState<{ oldEmail: string; newEmail: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const repos = getRepositories();
      await changeEmail(repos, newEmail, currentPassword);
      setSentTo({ oldEmail: profile.email, newEmail: newEmail.trim() });
      setChanging(false);
      setNewEmail("");
      setCurrentPassword("");
    } catch (err) {
      // Distinct, named error types (not raw Supabase messages) for the two
      // known failure causes — see EmailAlreadyInUseError's own comment for
      // why the "already in use" case specifically must stay generic
      // (anti-enumeration, Ticket 025 AK).
      if (err instanceof EmailAlreadyInUseError) {
        setError(t(lang, i18nProfile.emailAlreadyInUseError));
      } else if (err instanceof ReauthenticationFailedError) {
        setError(t(lang, i18nProfile.emailChangeWrongPasswordError));
      } else {
        setError(t(lang, i18nProfile.emailChangeGenericError));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    // No top border/padding here (unlike PasswordChangeAction below) — this
    // is now the first item inside ProfileSection's Ticket 032 "Sicherheit"
    // box, directly under its subtitle, so the box's own border/padding
    // already separates it from the display-name form above.
    <div className="flex flex-col gap-3">
      {!changing ? (
        <div>
          <button
            type="button"
            onClick={() => {
              setChanging(true);
              setError(null);
            }}
            className={buttonClass}
          >
            {t(lang, i18nProfile.emailChangeButton)}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-foreground/70">{t(lang, i18nProfile.emailChangeIntro)}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor="email-change-new-email" className="text-sm font-medium">
              {t(lang, i18nProfile.emailChangeNewEmailLabel)}
            </label>
            <input
              id="email-change-new-email"
              type="email"
              autoComplete="email"
              required
              disabled={pending}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="email-change-password" className="text-sm font-medium">
              {t(lang, i18nProfile.emailChangeCurrentPasswordLabel)}
            </label>
            <input
              id="email-change-password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className={errorClass}>{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending
                ? t(lang, i18nProfile.emailChangeSending)
                : t(lang, i18nProfile.emailChangeSubmit)}
            </button>
            <button
              type="button"
              onClick={() => {
                setChanging(false);
                setNewEmail("");
                setCurrentPassword("");
                setError(null);
              }}
              disabled={pending}
              className={buttonClass}
            >
              {t(lang, common.cancel)}
            </button>
          </div>
        </form>
      )}
      {sentTo && !changing && (
        <p className="text-sm text-foreground/70">
          {emailChangeSuccessMessage(lang, sentTo.oldEmail, sentTo.newEmail)}
        </p>
      )}
    </div>
  );
}

// "Passwort ändern" (Ticket 026, TimTracker-Starter repo — final ticket in
// the "Profil verwalten" series). Same two-step-reveal convention and own-
// state-per-action shape as EmailChangeAction just above (a button first,
// the form only after it's clicked, its own state so it doesn't tangle with
// the other forms in this section).
//
// Unlike EmailChangeAction, a successful change here takes effect
// immediately (no email confirmation step) and the AK explicitly requires
// no forced logout — Supabase's own updateUser({ password }) keeps the
// current session valid, which is left as-is rather than "fixed". The form
// collapses back to the button + a plain success message on success, same
// shape as EmailChangeAction's sentTo confirmation.
function PasswordChangeAction({ lang }: { lang: Lang }) {
  const [changing, setChanging] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Client-side only, no server roundtrip for this case — AK requirement.
    if (newPassword !== confirmNewPassword) {
      setError(t(lang, i18nProfile.passwordChangeMismatchError));
      return;
    }

    setPending(true);
    try {
      const repos = getRepositories();
      await changePassword(repos, newPassword, currentPassword);
      setSucceeded(true);
      setChanging(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      // Same re-auth error type changeEmail() throws — see
      // ReauthenticationFailedError's own comment for why it's shared
      // rather than a second, near-identical type. Any current-password
      // failure here is deliberately non-blocking otherwise: no logout, no
      // client-side retry limit (Supabase's own rate-limiting on
      // signInWithPassword is sufficient per the ticket's AK).
      if (err instanceof ReauthenticationFailedError) {
        setError(t(lang, i18nProfile.passwordChangeWrongPasswordError));
      } else {
        setError(t(lang, i18nProfile.passwordChangeGenericError));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    // Keeps its top border/padding — separates it from EmailChangeAction
    // just above it inside the Ticket 032 "Sicherheit" box.
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      {!changing ? (
        <div>
          <button
            type="button"
            onClick={() => {
              setChanging(true);
              setError(null);
              setSucceeded(false);
            }}
            className={buttonClass}
          >
            {t(lang, i18nProfile.passwordChangeButton)}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="password-change-current" className="text-sm font-medium">
              {t(lang, i18nProfile.passwordChangeCurrentPasswordLabel)}
            </label>
            <input
              id="password-change-current"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password-change-new" className="text-sm font-medium">
              {t(lang, i18nProfile.passwordChangeNewPasswordLabel)}
            </label>
            <input
              id="password-change-new"
              type="password"
              autoComplete="new-password"
              required
              disabled={pending}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password-change-confirm" className="text-sm font-medium">
              {t(lang, i18nProfile.passwordChangeConfirmLabel)}
            </label>
            <input
              id="password-change-confirm"
              type="password"
              autoComplete="new-password"
              required
              disabled={pending}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className={errorClass}>{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending
                ? t(lang, i18nProfile.passwordChangeSending)
                : t(lang, i18nProfile.passwordChangeSubmit)}
            </button>
            <button
              type="button"
              onClick={() => {
                setChanging(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
                setError(null);
              }}
              disabled={pending}
              className={buttonClass}
            >
              {t(lang, common.cancel)}
            </button>
          </div>
        </form>
      )}
      {succeeded && !changing && (
        <p className="text-sm text-foreground/70">
          {t(lang, i18nProfile.passwordChangeSuccess)}
        </p>
      )}
    </div>
  );
}

// Ticket 042: previously had no success feedback at all (only the ever-
// present language-change effect itself) and an inline errorClass block
// on failure. Now fires a toast either way, same as ProfileSection above
// — reuses common.saved for the success text rather than adding a new,
// near-identical "Sprache gespeichert" string.
function LanguageSection({
  initialLanguage,
  lang,
}: {
  initialLanguage: AppLanguage;
  lang: Lang;
}) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [language, setLanguage] = useState(initialLanguage);
  const [pending, setPending] = useState(false);

  async function handleChange(next: AppLanguage) {
    setPending(true);
    try {
      const repos = getRepositories();
      await setLanguagePreference(repos, next);
      setLanguage(next);
      showSuccess(t(lang, common.saved));
      // Refetches the current route's Server Component tree (root layout
      // included) against the now-updated cookie — this is what moves
      // <html lang>, this app's own Intl-based date formatting, AND (as
      // of Ticket 022) every translated UI string over to the new value,
      // since every Server Component page re-resolves getEffectiveLanguageCode()
      // on that refetch.
      router.refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, settings.languageSaveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground/70">
        {t(lang, settings.languageSectionTitle)}
      </h2>
      <div
        className="flex flex-col gap-1"
        role="radiogroup"
        aria-label={t(lang, settings.languageSectionTitle)}
      >
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
        {t(lang, settings.languageInfoPrefix)}
        <code>&lt;html lang&gt;</code>
        {t(lang, settings.languageInfoSuffix)}
      </p>
    </section>
  );
}

// Its red-tinted treatment (border-red-600/30, red heading below) stays
// exclusive to this destructive/unrecoverable action — Ticket 032 gave
// EmailChangeAction/PasswordChangeAction in ProfileSection above their own
// distinct-but-not-red "Sicherheit" tint (bg-paper/border-line) precisely so
// this red styling keeps its own, stronger meaning instead of being diluted
// across every security-adjacent action.
function DeleteAccountSection({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const confirmationWord = t(lang, settings.deleteConfirmationWord);
  const canConfirm = confirmationText.trim() === confirmationWord;

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
      setError(err instanceof Error ? err.message : t(lang, settings.deleteError));
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-red-600/30 p-5">
      <h2 className="text-sm font-medium text-red-700 dark:text-red-400">
        {t(lang, settings.deleteAccountTitle)}
      </h2>
      <p className="text-sm text-foreground/70">{t(lang, settings.deleteAccountBody)}</p>

      {!confirming ? (
        <div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={dangerButtonClass}
          >
            {t(lang, settings.deleteAccountButton)}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="delete-confirm" className="text-sm">
            {t(lang, settings.deleteConfirmPrefix)}{" "}
            <span className="font-semibold">{confirmationWord}</span>{" "}
            {t(lang, settings.deleteConfirmSuffix)}
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
              {pending ? t(lang, settings.deletePending) : t(lang, settings.deleteConfirm)}
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
              {t(lang, common.cancel)}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
