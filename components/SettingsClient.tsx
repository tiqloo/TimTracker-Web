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
  "w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50";

const buttonClass =
  "rounded-md border border-line px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50";

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
      <DeleteAccountSection lang={lang} />
    </div>
  );
}

// "Profil" (Ticket 024, TimTracker-Starter repo) — editable display name
// plus the two read-only account fields (email, account-creation date).
// Placed above LanguageSection per the ticket's AK. Same Client Component
// + pending/error state shape as LanguageSection/DeleteAccountSection
// below: optimistic local state update on success, then router.refresh()
// so DashboardNav (which resolves the profile server-side in
// app/(dashboard)/layout.tsx) picks up the new value too — same reasoning
// LanguageSection's own comment gives for why it calls router.refresh()
// after already updating its own state locally.
function ProfileSection({ profile, lang }: { profile: Profile; lang: Lang }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      const repos = getRepositories();
      await updateDisplayName(repos, displayName);
      // Mirrors what the save just persisted (trim, empty -> "") rather
      // than re-fetching — same optimistic-update pattern LanguageSection
      // uses, see its own comment.
      setDisplayName(normalizeDisplayNameInput(displayName) ?? "");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, i18nProfile.displayNameSaveError));
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
            onChange={(e) => {
              setDisplayName(e.target.value);
              setSaved(false);
            }}
            className={inputClass}
          />
        </div>
        {error && <p className={errorClass}>{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? t(lang, common.saving) : t(lang, common.save)}
          </button>
          {saved && !pending && !error && (
            <span className="text-sm text-foreground/60">
              {t(lang, i18nProfile.displayNameSaved)}
            </span>
          )}
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
      <EmailChangeAction profile={profile} lang={lang} />
      <PasswordChangeAction lang={lang} />
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
    <div className="flex flex-col gap-3 border-t border-line pt-4">
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

function LanguageSection({
  initialLanguage,
  lang,
}: {
  initialLanguage: AppLanguage;
  lang: Lang;
}) {
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
      // included) against the now-updated cookie — this is what moves
      // <html lang>, this app's own Intl-based date formatting, AND (as
      // of Ticket 022) every translated UI string over to the new value,
      // since every Server Component page re-resolves getEffectiveLanguageCode()
      // on that refetch.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, settings.languageSaveError));
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
      {error && <p className={errorClass}>{error}</p>}
    </section>
  );
}

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
