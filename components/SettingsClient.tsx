"use client";

// Interactive half of "Einstellungen" (Ticket 018, Phase 1e): the
// language picker and the "Account löschen" confirmation flow. A Client
// Component for the same reason ProjectsClient.tsx is — both actions need
// immediate feedback, no full page reload. Gets its Repositories instance
// from lib/application/client.ts (the designated exception, see
// CLAUDE.md's "Resolved 2026-08-25" entry) and calls straight into
// lib/application/language.ts / lib/application/auth.ts — never
// lib/repositories/* directly.
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { getRepositories } from "@/lib/application/client";
import { setLanguagePreference, type AppLanguage } from "@/lib/application/language";
import { setDailyGoalHours } from "@/lib/application/daily-goal";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  logout,
  updateDisplayName,
  uploadAvatar,
  removeAvatar,
  getAvatarUrl,
  EmailAlreadyInUseError,
  ReauthenticationFailedError,
  type Profile,
} from "@/lib/application/auth";
import { APP_LANGUAGES, languageCodeToLocale, languageDisplayName } from "@/lib/domain/language";
import { normalizeDisplayNameInput } from "@/lib/domain/profile";
import type { Subscription } from "@/lib/domain/subscription";
import {
  normalizeDailyGoalHoursInput,
  MIN_DAILY_GOAL_HOURS,
  MAX_DAILY_GOAL_HOURS,
} from "@/lib/domain/daily-goal";
import { formatFullDate } from "@/lib/format";
import {
  billing,
  common,
  emailChangeSuccessMessage,
  profile as i18nProfile,
  settings,
  t,
  themeLabels,
  workspaces as i18nWorkspaces,
  type Lang,
} from "@/lib/i18n";
import {
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui/button-styles";
import { errorMessageClass } from "@/lib/ui/status-styles";
import { errorFeedbackProps, successFeedbackProps } from "@/lib/ui/feedback";
import { applyThemePreference } from "@/components/ThemeInitializer";
import { APP_THEMES, parseTheme, THEME_STORAGE_KEY, type AppTheme } from "@/lib/domain/theme";

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-background/60 px-3.5 text-sm outline-none transition-all duration-150 hover:border-foreground/20 focus:border-brand focus:bg-surface focus-visible:ring-4 focus-visible:ring-brand/10 disabled:opacity-50";

// Ticket 048: Secondary tier (lib/ui/button-styles.ts) — was a locally
// defined "buttonClass" (border-line, no fill) before this ticket's button
// consolidation pass; primaryButtonClass/dangerButtonClass below are now
// imported the same way rather than locally defined (dangerButtonClass
// previously used a raw bg-red-600/text-white pair with no dark-mode
// variant at all — the shared module's bg-danger/text-white now at least
// carries a conscious, documented dark value, see globals.css).
const buttonClass = secondaryButtonClass;

// Ticket 048: lib/ui/status-styles.ts (--danger token) — was locally
// defined before this ticket's status-token consolidation pass.
const errorClass = errorMessageClass;

// Ticket 041: main settings page now groups into clearly named, generously
// spaced sections (AK) rather than one flat list — Profil (incl. 032's
// "Sicherheit" subsection), Sprache, Abo, then the two GDPR "Konto-
// Grundrechte" actions (046's data export, then the danger zone) last, in
// ascending order of how rarely/carefully a user should reach for them.
// `gap-10` (unchanged from before this ticket) already gives every section
// its own clear visual break — the AK explicitly allows this ("Abschnitts-
// Überschriften mit ausreichend visuellem Abstand"), no tabs/wizard needed.
export function SettingsClient({
  initialLanguage,
  profile,
  subscription,
  lang,
  initialDailyGoalHours,
}: {
  initialLanguage: AppLanguage;
  profile: Profile;
  subscription: Subscription;
  lang: Lang;
  initialDailyGoalHours: number | null;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ProfileSection profile={profile} lang={lang} />
      <WorkspaceSection lang={lang} />
      <LanguageSection initialLanguage={initialLanguage} lang={lang} />
      <DesignSection lang={lang} />
      {/* Ticket 044: placed right after LanguageSection, per the ticket's
          AK ("nahe dem bestehenden 'Profil'-/Sprache-Abschnitt") — groups
          with the other plain user preferences (Sprache, Tagesziel) before
          the account-status/GDPR sections below. Orchestrator merge note
          (2026-09-01): Ticket 041 independently wanted Abo placed right
          after Sprache too — resolved by keeping the two lighter
          "Präferenz"-style sections (Sprache, Tagesziel) adjacent, with
          the heavier account-status card (Abo) right after. */}
      <DailyGoalSection initialDailyGoalHours={initialDailyGoalHours} lang={lang} />
      <SubscriptionSection subscription={subscription} lang={lang} />
      <DataExportSection lang={lang} />
      <DeleteAccountSection lang={lang} />
    </div>
  );
}

// Ticket 100 — entry point into the new "Unternehmens-Workspace
// erstellen" flow (its own page, app/(dashboard)/dashboard/workspaces/new,
// not folded into this file — see that page's own comment for why). Just
// a link/description card, same shape as DataExportSection below minus
// the async handler, since the actual work happens on the target page.
function WorkspaceSection({ lang }: { lang: Lang }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line/90 bg-surface p-6 shadow-[0_16px_45px_-38px_rgba(24,24,23,0.45)]">
      <h2 className="text-base font-semibold tracking-tight">{t(lang, i18nWorkspaces.pageTitle)}</h2>
      <p className="text-sm text-foreground/70">{t(lang, i18nWorkspaces.pageDescription)}</p>
      <div>
        <Link href="/dashboard/workspaces/new" className={buttonClass}>
          {t(lang, i18nWorkspaces.createButton)}
        </Link>
      </div>
    </section>
  );
}

function DesignSection({ lang }: { lang: Lang }) {
  const theme = useSyncExternalStore(
    (notify) => {
      window.addEventListener("tiqloo-theme-change", notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener("tiqloo-theme-change", notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY)),
    () => "system",
  );

  function handleThemeChange(nextTheme: AppTheme) {
    if (nextTheme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyThemePreference(nextTheme);
    window.dispatchEvent(new Event("tiqloo-theme-change"));
  }

  const icons = { system: Monitor, light: Sun, dark: Moon } as const;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line/90 bg-surface p-6 shadow-[0_16px_45px_-38px_rgba(24,24,23,0.45)]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
          <Palette size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t(lang, settings.designSectionTitle)}</h2>
          <p className="mt-0.5 text-xs text-text-secondary">{t(lang, settings.designSectionBody)}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-paper p-1.5" role="radiogroup" aria-label={t(lang, settings.designSectionTitle)}>
        {APP_THEMES.map((option) => {
          const Icon = icons[option];
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={theme === option}
              onClick={() => handleThemeChange(option)}
              className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand/50 ${
                theme === option
                  ? "bg-surface text-brand shadow-[0_6px_18px_-12px_rgba(24,24,23,0.45)]"
                  : "text-text-secondary hover:bg-surface/60 hover:text-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              {t(lang, themeLabels[option])}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// "Abo" (Ticket 041) — compact subscription overview card that replaces
// the previous bare "Abo verwalten →" text link
// (app/(dashboard)/dashboard/settings/page.tsx used to render this itself,
// outside SettingsClient entirely — see this ticket's "Ausgangslage").
// `subscription` is fetched server-side in page.tsx via the exact same
// getSubscriptionStatus() call billing/page.tsx already uses (no second
// code path, no client-side Repositories call here), so this stays a
// plain presentational piece despite living in this "use client" file.
//
// Deliberately a SUBSET of billing/page.tsx's own card: status + the
// relevant renewal/end date only, no trial-days-remaining countdown and
// no customer-portal button — full management (incl. the Stripe portal,
// which must not be duplicated here per the AK) stays exclusively on
// /dashboard/settings/billing, this card only orients the user and links
// there via the same manageSubscriptionLink text the old standalone link
// used.
//
// Edge case (AK): a `status: "none"` user (no trial/subscription on
// file) gets billing.noSubscriptionOnFile instead of a blank-looking date
// row — same fallback billing/page.tsx already uses for the identical
// case, reused rather than reinvented.
function SubscriptionSection({
  subscription,
  lang,
}: {
  subscription: Subscription;
  lang: Lang;
}) {
  const locale = languageCodeToLocale(lang);
  const periodEndLabel =
    subscription.status === "trialing"
      ? billing.trialEndsOn
      : subscription.status === "active"
        ? billing.nextRenewalOn
        : billing.accessEndedOn;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line/90 bg-surface p-6 shadow-[0_16px_45px_-38px_rgba(24,24,23,0.45)]">
      <h2 className="text-base font-semibold tracking-tight">
        {t(lang, settings.subscriptionSectionTitle)}
      </h2>
      <p className="text-sm">
        {t(lang, billing.statusPrefix)}{" "}
        <span className="font-medium">
          {t(lang, billing.statusLabels[subscription.status])}
        </span>
      </p>
      {subscription.currentPeriodEnd ? (
        <p className="text-sm text-foreground/70">
          {t(lang, periodEndLabel)}{" "}
          <span className="font-mono tabular-nums">
            {formatFullDate(subscription.currentPeriodEnd, locale)}
          </span>
          .
        </p>
      ) : (
        subscription.status === "none" && (
          <p className="text-sm text-foreground/70">{t(lang, billing.noSubscriptionOnFile)}</p>
        )
      )}
      <div>
        <Link
          href="/dashboard/settings/billing"
          className="text-sm font-medium text-brand hover:underline"
        >
          {t(lang, settings.manageSubscriptionLink)}
        </Link>
      </div>
    </section>
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
      link.download = filenameMatch?.[1] ?? "Tiqloo-Datenexport.json";
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
    <section className="flex flex-col gap-3 rounded-2xl border border-line/90 bg-surface p-6 shadow-[0_16px_45px_-38px_rgba(24,24,23,0.45)]">
      <h2 className="text-base font-semibold tracking-tight">
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
const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";

function ProfileSection({ profile, lang }: { profile: Profile; lang: Lang }) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [pending, setPending] = useState(false);

  // Ticket 029 — same state/effect shape as WorkspaceSettingsClient's own
  // logoPath/logoUrl/logoBusy trio: `avatarPath` is the persisted pointer,
  // `avatarUrl` a freshly signed (short-lived, private bucket) URL
  // resolved client-side whenever the pointer changes.
  const [avatarPath, setAvatarPath] = useState(profile.avatarPath);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    // No reset to `null` here when `avatarPath` is falsy — same as
    // WorkspaceSettingsClient's own identical effect: the render below
    // guards on `avatarPath && avatarUrl` together, so a stale `avatarUrl`
    // left over from before a removal is simply never rendered, and gets
    // refreshed the moment `avatarPath` becomes truthy again anyway.
    if (!avatarPath) return;
    let cancelled = false;
    (async () => {
      try {
        const repos = getRepositories();
        const url = await getAvatarUrl(repos, avatarPath);
        if (!cancelled) setAvatarUrl(url);
      } catch {
        if (!cancelled) setAvatarUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

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

  async function handleAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarBusy(true);
    try {
      const repos = getRepositories();
      const path = await uploadAvatar(repos, file);
      setAvatarPath(path);
      showSuccess(t(lang, i18nProfile.avatarUploadSuccess));
      router.refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nProfile.avatarUploadError));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarBusy(true);
    try {
      const repos = getRepositories();
      await removeAvatar(repos);
      setAvatarPath(null);
      showSuccess(t(lang, i18nProfile.avatarRemoveSuccess));
      router.refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, i18nProfile.avatarRemoveError));
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line/90 bg-surface p-6 shadow-[0_16px_45px_-38px_rgba(24,24,23,0.45)] lg:col-span-2 sm:p-7">
      <div>
        <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-brand uppercase">Account</p>
        <h2 className="text-lg font-semibold tracking-tight">
        {t(lang, i18nProfile.sectionTitle)}
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
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
      {/* Ticket 029 — same "own mini-card, image + upload/remove controls"
          shape as WorkspaceSettingsClient's logo block, see that
          component's own comment for the full reasoning (signed URL
          re-resolved client-side on every avatarPath change, a private
          bucket has no other way to render it). */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-background p-5">
        <h3 className="text-sm font-medium text-foreground/70">{t(lang, i18nProfile.avatarTitle)}</h3>
        {avatarPath && avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived Storage URL isn't a fit for next/image's static optimization pipeline.
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border border-line object-cover" />
        ) : (
          <p className="text-xs text-text-secondary">{t(lang, i18nProfile.avatarEmptyState)}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${secondaryButtonClass} cursor-pointer`}>
            {avatarBusy ? t(lang, i18nProfile.avatarUploading) : t(lang, i18nProfile.avatarUploadButton)}
            <input type="file" accept={AVATAR_ACCEPT} onChange={handleAvatarSelected} disabled={avatarBusy} className="hidden" />
          </label>
          {avatarPath && (
            <button type="button" onClick={handleAvatarRemove} disabled={avatarBusy} className={secondaryButtonClass}>
              {avatarBusy ? t(lang, i18nProfile.avatarRemoving) : t(lang, i18nProfile.avatarRemoveButton)}
            </button>
          )}
        </div>
      </div>
      <dl className="grid gap-3 border-t border-line pt-5 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-background px-4 py-3">
          <dt className="text-foreground/60">{t(lang, i18nProfile.emailLabel)}</dt>
          <dd className="mt-1 truncate font-medium">{profile.email}</dd>
        </div>
        <div className="rounded-xl bg-background px-4 py-3">
          <dt className="text-foreground/60">{t(lang, i18nProfile.createdAtLabel)}</dt>
          <dd className="mt-1 font-mono font-medium tabular-nums">
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
      {/* Ticket 048: rounded-lg (8px) bumped to rounded-xl (12px) — the
          ticket's radius AK asks for cards/larger containers to land in
          the 10-14px band; this nested "Sicherheit" box is a card-within-
          a-card, same treatment as every other card container in this
          file. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line/80 bg-background p-4 sm:p-5">
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
              autoFocus
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
          {error && <p {...errorFeedbackProps} className={errorClass}>{error}</p>}
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
        <p {...successFeedbackProps} className="text-sm text-foreground/70">
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
              autoFocus
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
          {error && <p {...errorFeedbackProps} className={errorClass}>{error}</p>}
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
        <p {...successFeedbackProps} className="text-sm text-foreground/70">
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
    <section className="flex flex-col gap-4 rounded-2xl border border-line/90 bg-surface p-6 shadow-[0_16px_45px_-38px_rgba(24,24,23,0.45)]">
      <h2 className="text-base font-semibold tracking-tight">
        {t(lang, settings.languageSectionTitle)}
      </h2>
      <div
        className="grid gap-2"
        role="radiogroup"
        aria-label={t(lang, settings.languageSectionTitle)}
      >
        {APP_LANGUAGES.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${language === option ? "border-brand/30 bg-brand-soft font-medium text-brand" : "border-line bg-background/50 hover:bg-background"}`}
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

// "Tägliches Ziel" (Ticket 044, TimTracker-Starter repo — follow-up to
// 033's hero-number redesign). Same shape/pending/toast pattern as
// LanguageSection just above: a plain number input, optimistic local
// state update via the same domain normalizer the use-case itself applies
// server-side (normalizeDailyGoalHoursInput — mirrors ProfileSection's
// normalizeDisplayNameInput precedent), then a success/error toast
// (Ticket 042). Deliberately does NOT call router.refresh() the way
// ProfileSection/LanguageSection do — DashboardNav doesn't show this
// value anywhere, and "Heute" re-fetches it on its own next server render
// regardless (ticket edge case: no live-sync requirement between tabs).
function DailyGoalSection({
  initialDailyGoalHours,
  lang,
}: {
  initialDailyGoalHours: number | null;
  lang: Lang;
}) {
  const { showSuccess, showError } = useToast();
  const [value, setValue] = useState(
    initialDailyGoalHours !== null ? String(initialDailyGoalHours) : "",
  );
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const repos = getRepositories();
      // A blank field parses to NaN -> normalizeDailyGoalHoursInput below
      // already treats that the same as "no goal" (see its own doc), so
      // there's no separate empty-string branch needed here.
      const rawHours = Number(value);
      await setDailyGoalHours(repos, rawHours);
      const normalized = normalizeDailyGoalHoursInput(rawHours);
      setValue(normalized !== null ? String(normalized) : "");
      showSuccess(t(lang, common.saved));
    } catch (err) {
      showError(err instanceof Error ? err.message : t(lang, settings.dailyGoalSaveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line/90 bg-surface p-6 shadow-[0_16px_45px_-38px_rgba(24,24,23,0.45)]">
      <h2 className="text-base font-semibold tracking-tight">
        {t(lang, settings.dailyGoalSectionTitle)}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="daily-goal-hours" className="text-sm font-medium">
            {t(lang, settings.dailyGoalLabel)}
          </label>
          <input
            id="daily-goal-hours"
            type="number"
            inputMode="decimal"
            min={MIN_DAILY_GOAL_HOURS}
            max={MAX_DAILY_GOAL_HOURS}
            step="0.5"
            disabled={pending}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            // w-32, not the shared full-width inputClass — a hours value is
            // a short number, not free text; matches the same "size the
            // input to its content" instinct as e.g. a quantity field.
            className={`${inputClass} w-32`}
          />
          <p className="text-xs text-foreground/60">{t(lang, settings.dailyGoalHint)}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? t(lang, common.saving) : t(lang, common.save)}
          </button>
        </div>
      </form>
    </section>
  );
}

// Ticket 041: pulled down in visual weight — the AK's own feedback quote
// ("eine destruktive Aktion sollte klar als gefährlich erkennbar sein,
// aber nicht das prominenteste Element einer normalen Settings-Seite")
// meant the red `border-red-600/30` card that used to be always-on (same
// as every other card's rounded-xl border, just red) had to stop being
// the loudest thing on the page. Now: a neutral `border-line` card titled
// "Gefahrenbereich" with one plain sentence + a plain (non-danger) button
// by default — the red treatment (border, heading color, dangerButtonClass
// on the actual delete button) only kicks in once `confirming` is true,
// i.e. exactly "beim eigentlichen Löschen-Vorgang" (AK) so the warning
// isn't lost at the moment it matters. Still positioned LAST among the
// page's sections (unchanged from before this ticket) — least frequently
// needed, most dangerous, read last.
//
// Ticket 032 gave EmailChangeAction/PasswordChangeAction in ProfileSection
// their own distinct-but-not-red "Sicherheit" tint (bg-paper/border-line)
// precisely so red stays exclusive to this action's actual confirm step —
// this ticket's change keeps that same principle, just narrows red down
// further to only the confirm step itself rather than the whole card.
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
    <section
      // Ticket 048: border-red-600/30 -> border-danger/30 (the new status
      // token, used here for its intended decorative/accent role — an
      // outline, not body text — see globals.css's --danger comment). The
      // heading text just below deliberately KEEPS text-red-700/
      // dark:text-red-400 rather than switching to --danger: that pair
      // already clears AA text contrast (unlike the literal --danger hex
      // as text, see globals.css), and this ticket's token pass is
      // explicit about not regressing real error-message legibility.
      className={`flex flex-col gap-3 rounded-2xl border bg-surface p-6 transition-colors duration-150 lg:col-span-2 ${
        confirming ? "border-danger/30" : "border-line"
      }`}
    >
      <h2
        className={`text-sm font-medium ${
          confirming ? "text-red-700 dark:text-red-400" : "text-foreground/70"
        }`}
      >
        {t(lang, settings.dangerZoneTitle)}
      </h2>
      <p className="text-sm text-foreground/70">
        {t(lang, confirming ? settings.deleteAccountBody : settings.dangerZoneIntro)}
      </p>

      {!confirming ? (
        <div>
          <button type="button" onClick={() => setConfirming(true)} className={buttonClass}>
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
            autoFocus
            type="text"
            disabled={pending}
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className={inputClass}
            autoComplete="off"
          />
          {error && <p {...errorFeedbackProps} className={errorClass}>{error}</p>}
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
