// Full-UI translation dictionary (Ticket 022, TimTracker-Starter repo) —
// closes the gap lib/domain/language.ts's former SCOPE NOTE documented:
// the language PREFERENCE (Ticket 018, Phase 1e) already resolved to a
// concrete "de" | "en" code and drove <html lang> plus Intl-based date
// formatting, but none of the actual UI text followed it. This file is
// that missing piece: a small, own key-value mapping (no next-intl or
// similar — same "no unnecessary dependency" call this repo already made
// for CSV/PDF export, see lib/format.ts's formatHistoryCsv and
// lib/pdf/history-export-document.tsx) analogous in spirit to
// Resources/Localizable.xcstrings on the native side.
//
// Shape: instead of a flat `Record<string, {de,en}>` looked up by a
// string key (which xcstrings uses, but which loses autocomplete and
// invites typo'd/duplicate keys in plain TS), every string is a
// `Translated` object exported directly from a per-feature namespace
// const, e.g. `nav.today`, `projects.editButton`. Call sites do
// `t(lang, nav.today)` — the object reference itself IS the lookup key,
// so a typo is a compile error, not a silent fallback. Same "lightweight
// own mapping" spirit the ticket asked for, adapted to what TypeScript
// makes easiest to keep correct.
//
// Terminology consistency (ticket AK): English wording for concepts that
// already have an established native-app translation (Resources/
// Localizable.xcstrings in TimTracker-Starter) reuses that exact English
// text — e.g. "Automatikzeit" -> "Automatic time", "Abo verwalten" ->
// "Manage Subscription", "Projektzeit" -> "Project time" — so a user of
// both the web dashboard and the native app never sees the same concept
// named two different ways. German strings are IDENTICAL to what already
// shipped (copied verbatim from each component) — this ticket adds
// English, it does not rewrite existing German copy.
export type Lang = "de" | "en";

export interface Translated {
  de: string;
  en: string;
}

// The one lookup function every call site uses. `entry` is a plain
// {de,en} object (usually one of the named consts below, occasionally
// returned ad hoc by one of the interpolating helpers further down).
export function t(lang: Lang, entry: Translated): string {
  return entry[lang];
}

// --- Shared across multiple components -----------------------------

export const common = {
  cancel: { de: "Abbrechen", en: "Cancel" },
  save: { de: "Speichern", en: "Save" },
  saving: { de: "Wird gespeichert…", en: "Saving…" },
  color: { de: "Farbe", en: "Color" },
  name: { de: "Name", en: "Name" },
  note: { de: "Notiz", en: "Note" },
  email: { de: "E-Mail", en: "Email" },
  password: { de: "Passwort", en: "Password" },
} satisfies Record<string, Translated>;

// --- components/DashboardNav.tsx ------------------------------------

export const nav = {
  today: { de: "Heute", en: "Today" },
  history: { de: "Historie", en: "History" },
  projects: { de: "Projekte", en: "Projects" },
  settings: { de: "Einstellungen", en: "Settings" },
  logout: { de: "Logout", en: "Log Out" },
  loggingOut: { de: "Wird abgemeldet…", en: "Logging out…" },
} satisfies Record<string, Translated>;

// --- components/AccessGate.tsx --------------------------------------

export const accessGate = {
  statusPrefix: { de: "Status:", en: "Status:" },
  message: {
    de: "Kein aktiver Testzeitraum oder Abo mehr.",
    en: "No active trial or subscription anymore.",
  },
  // Distinct from billing.statusLabels — this variant of "active" spells
  // out that the CURRENT billing period has already ended (a user who
  // paid but is now past their period end), which only matters on the
  // read-only gate screen, not on the billing status page itself.
  statusLabels: {
    trialing: { de: "Testphase", en: "Trial" },
    active: { de: "Aktiv (Zeitraum abgelaufen)", en: "Active (period ended)" },
    past_due: { de: "Zahlung überfällig", en: "Payment overdue" },
    canceled: { de: "Gekündigt", en: "Canceled" },
    unpaid: { de: "Nicht bezahlt", en: "Unpaid" },
    incomplete_expired: { de: "Unvollständig (abgelaufen)", en: "Incomplete (expired)" },
    none: { de: "Kein Abo", en: "No subscription" },
  } satisfies Record<string, Translated>,
} as const;

// --- components/DayDetail.tsx ---------------------------------------

export const dayDetail = {
  totalAutomaticTime: { de: "Automatikzeit gesamt", en: "Total automatic time" },
  projectTime: { de: "Projektzeit", en: "Project time" },
  unassignedTime: { de: "Nicht zugeordnete Zeit", en: "Unassigned time" },
  entries: { de: "Einträge", en: "Entries" },
  running: { de: "läuft", en: "running" },
  noEntriesToday: {
    de: "Noch keine Zeiteinträge für heute.",
    en: "No time entries for today yet.",
  },
  noEntriesThisDay: {
    de: "Keine Zeiteinträge für diesen Tag.",
    en: "No time entries for this day.",
  },
} satisfies Record<string, Translated>;

// --- components/HistoryChart.tsx -------------------------------------

export const historyChart = {
  automaticTime: { de: "Automatikzeit", en: "Automatic time" },
  projectTime: { de: "Projektzeit", en: "Project time" },
  dailyValues: { de: "Tageswerte", en: "Daily values" },
  monthlyValues: {
    de: "Monatswerte (aggregiert)",
    en: "Monthly values (aggregated)",
  },
} satisfies Record<string, Translated>;

export function historyChartAriaLabel(lang: Lang, granularity: "day" | "month"): string {
  const perUnit =
    granularity === "day"
      ? { de: "pro Tag", en: "per day" }
      : { de: "pro Monat", en: "per month" };
  return lang === "de"
    ? `Balkendiagramm Automatikzeit vs. Projektzeit, ${perUnit.de}`
    : `Bar chart, automatic time vs. project time, ${perUnit.en}`;
}

export function historyChartTooltip(
  lang: Lang,
  barLabel: string,
  automaticLabel: string,
  projectLabel: string,
): string {
  return lang === "de"
    ? `${barLabel}: Automatik ${automaticLabel}, Projekt ${projectLabel}`
    : `${barLabel}: Automatic ${automaticLabel}, Project ${projectLabel}`;
}

// --- components/ManageSubscriptionButton.tsx --------------------------

export const manageSubscriptionButton = {
  manage: { de: "Abo verwalten", en: "Manage Subscription" },
  opening: { de: "Wird geöffnet…", en: "Opening…" },
  error: {
    de: "Abo-Verwaltung konnte nicht geöffnet werden.",
    en: "Could not open subscription management.",
  },
} satisfies Record<string, Translated>;

// --- components/ProjectsClient.tsx / app/(dashboard)/dashboard/projects ---

export const projects = {
  pageTitle: { de: "Projekte", en: "Projects" },
  activeProjects: { de: "Aktive Projekte", en: "Active Projects" },
  archivedProjects: { de: "Archivierte Projekte", en: "Archived Projects" },
  noProjectsYet: { de: "Noch keine Projekte angelegt.", en: "No projects created yet." },
  newProject: { de: "Neues Projekt", en: "New Project" },
  customerOptional: { de: "Kunde (optional)", en: "Customer (optional)" },
  noteOptional: { de: "Notiz (optional)", en: "Note (optional)" },
  nameRequiredError: {
    de: "Projektname darf nicht leer sein.",
    en: "Project name cannot be empty.",
  },
  createDuplicateWarning: {
    de: "Ein Projekt mit diesem Namen existiert bereits — Anlegen ist trotzdem möglich (z. B. für unterschiedliche Kunden).",
    en: "A project with this name already exists — creating it anyway is fine (e.g. for different customers).",
  },
  editDuplicateWarning: {
    de: "Ein Projekt mit diesem Namen existiert bereits — Speichern ist trotzdem möglich (z. B. für unterschiedliche Kunden).",
    en: "A project with this name already exists — saving it anyway is fine (e.g. for different customers).",
  },
  creating: { de: "Wird angelegt…", en: "Creating…" },
  createProject: { de: "Projekt anlegen", en: "Create Project" },
  createError: {
    de: "Projekt konnte nicht angelegt werden.",
    en: "Project could not be created.",
  },
  archived: { de: "Archiviert", en: "Archived" },
  edit: { de: "Bearbeiten", en: "Edit" },
  reactivate: { de: "Reaktivieren", en: "Reactivate" },
  archive: { de: "Archivieren", en: "Archive" },
  archiveToggleError: {
    de: "Status konnte nicht geändert werden.",
    en: "Status could not be changed.",
  },
  saveError: {
    de: "Projekt konnte nicht gespeichert werden.",
    en: "Project could not be saved.",
  },
} satisfies Record<string, Translated>;

// --- app/(dashboard)/dashboard/page.tsx ("Heute") --------------------

export const today = {
  pageTitle: { de: "Heute", en: "Today" },
  goToHistory: { de: "Zur Historie →", en: "Go to History →" },
} satisfies Record<string, Translated>;

// --- app/(dashboard)/dashboard/history/page.tsx -----------------------

export const history = {
  pageTitle: { de: "Historie", en: "History" },
  last30Days: { de: "Letzte 30 Tage", en: "Last 30 Days" },
  thisWeek: { de: "Diese Woche", en: "This Week" },
  thisMonth: { de: "Dieser Monat", en: "This Month" },
  thisYear: { de: "Dieses Jahr", en: "This Year" },
  from: { de: "Von", en: "From" },
  to: { de: "Bis", en: "To" },
  apply: { de: "Anwenden", en: "Apply" },
  exportCsv: { de: "Als CSV exportieren", en: "Export as CSV" },
  exportPdf: { de: "Als PDF exportieren", en: "Export as PDF" },
  noActivity: {
    de: "Keine Aktivität in diesem Zeitraum.",
    en: "No activity in this period.",
  },
  automatic: { de: "Automatik", en: "Automatic" },
  project: { de: "Projekt", en: "Project" },
  unassigned: { de: "Nicht zugeordnet", en: "Unassigned" },
  backToHistory: { de: "← Zurück zur Historie", en: "← Back to History" },
} satisfies Record<string, Translated>;

// --- app/(dashboard)/dashboard/settings/page.tsx + SettingsClient.tsx --

export const settings = {
  pageTitle: { de: "Einstellungen", en: "Settings" },
  manageSubscriptionLink: { de: "Abo verwalten →", en: "Manage Subscription →" },
  languageSectionTitle: { de: "Sprache", en: "Language" },
  // Split around the <code>&lt;html lang&gt;</code> markup the component
  // renders inline — see SettingsClient.tsx's LanguageSection.
  languageInfoPrefix: {
    de: "Wirkt sofort auf die gesamte Oberfläche — Texte, Datumsformate und die Seitensprache (",
    en: "Takes effect immediately across the whole interface — text, date formats, and the page language (",
  },
  languageInfoSuffix: { de: ").", en: ")." },
  languageSaveError: {
    de: "Sprache konnte nicht gespeichert werden.",
    en: "Language could not be saved.",
  },
  deleteAccountTitle: { de: "Account löschen", en: "Delete Account" },
  deleteAccountBody: {
    de: "Löscht deinen Account unwiderruflich, inklusive aller Cloud-Daten (Projekte, Zeiteinträge, Abo). Lokale Daten auf deinen Geräten bleiben unangetastet. Diese Aktion kann nicht rückgängig gemacht werden.",
    en: "Permanently deletes your account, including all cloud data (projects, time entries, subscription). Local data on your devices stays untouched. This action cannot be undone.",
  },
  deleteAccountButton: { de: "Account löschen…", en: "Delete Account…" },
  deleteConfirmationWord: { de: "LÖSCHEN", en: "DELETE" },
  deletePending: { de: "Wird gelöscht…", en: "Deleting…" },
  deleteConfirm: { de: "Endgültig löschen", en: "Delete Permanently" },
  deleteError: {
    de: "Konto konnte nicht gelöscht werden.",
    en: "Account could not be deleted.",
  },
  // Split around the bolded confirmation word — see SettingsClient.tsx's
  // DeleteAccountSection.
  deleteConfirmPrefix: { de: "Gib", en: "Type" },
  deleteConfirmSuffix: { de: "ein, um zu bestätigen:", en: "to confirm:" },
} satisfies Record<string, Translated>;

// --- app/(dashboard)/dashboard/settings/billing/page.tsx --------------

export const billing = {
  pageTitle: { de: "Abo verwalten", en: "Manage Subscription" },
  statusPrefix: { de: "Status:", en: "Status:" },
  statusLabels: {
    trialing: { de: "Testphase", en: "Trial" },
    active: { de: "Aktiv", en: "Active" },
    past_due: { de: "Zahlung überfällig", en: "Payment overdue" },
    canceled: { de: "Gekündigt", en: "Canceled" },
    unpaid: { de: "Nicht bezahlt", en: "Unpaid" },
    incomplete_expired: { de: "Unvollständig (abgelaufen)", en: "Incomplete (expired)" },
    none: { de: "Kein Abo", en: "No subscription" },
  } satisfies Record<string, Translated>,
  trialEndsOn: { de: "Testphase endet am", en: "Trial ends on" },
  nextRenewalOn: { de: "Nächste Verlängerung am", en: "Next renewal on" },
  accessEndedOn: { de: "Zugriff endete am", en: "Access ended on" },
  noSubscriptionOnFile: {
    de: "Kein Testzeitraum oder Abo hinterlegt.",
    en: "No trial period or subscription on file.",
  },
  backToSettings: { de: "← Zurück zu den Einstellungen", en: "← Back to Settings" },
} as const;

// Mirrors the native app's "Noch %@ Tage Testphase" / "%@ days left in
// trial" plural pair (Resources/Localizable.xcstrings) — singular "Tag"/
// "day" at exactly 1, plural otherwise. Split into "before"/"after" the
// actual number (rather than one interpolated string) so the caller can
// keep the number itself in its own `font-mono tabular-nums` span — German
// puts a word before the number ("Noch"), English doesn't, hence `before`
// can be empty.
export function trialDaysRemainingParts(
  lang: Lang,
  days: number,
): { before: string; after: string } {
  if (lang === "de") {
    return { before: "Noch", after: `${days === 1 ? "Tag" : "Tage"} Testphase.` };
  }
  return { before: "", after: `${days === 1 ? "day" : "days"} left in trial.` };
}

// --- app/(auth)/login (components/LoginForm.tsx) -----------------------

export const login = {
  title: { de: "Anmelden", en: "Sign In" },
  accountDeleted: {
    de: "Dein Account wurde erfolgreich gelöscht.",
    en: "Your account has been deleted successfully.",
  },
  forgotPassword: { de: "Passwort vergessen?", en: "Forgot password?" },
  signingIn: { de: "Wird angemeldet…", en: "Signing in…" },
  submit: { de: "Anmelden", en: "Sign In" },
  noAccountYet: { de: "Noch kein Konto?", en: "Don't have an account?" },
  registerLink: { de: "Registrieren", en: "Sign Up" },
  genericError: { de: "E-Mail oder Passwort ist falsch.", en: "Email or password is incorrect." },
  emailNotConfirmedError: {
    de: "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungsmail).",
    en: "Please confirm your email address first (link in the confirmation email).",
  },
} satisfies Record<string, Translated>;

// --- app/(auth)/register (components/RegisterForm.tsx) -----------------

export const register = {
  title: { de: "Konto erstellen", en: "Create Account" },
  passwordConfirm: { de: "Passwort bestätigen", en: "Confirm Password" },
  passwordMismatchError: {
    de: "Die Passwörter stimmen nicht überein.",
    en: "The passwords do not match.",
  },
  genericError: { de: "Registrierung fehlgeschlagen.", en: "Registration failed." },
  creating: { de: "Wird erstellt…", en: "Creating…" },
  submit: { de: "Konto erstellen", en: "Create Account" },
  alreadyHaveAccount: { de: "Bereits ein Konto?", en: "Already have an account?" },
  loginLink: { de: "Anmelden", en: "Sign In" },
  almostDoneTitle: { de: "Fast geschafft", en: "Almost Done" },
  confirmationSentBody: {
    de: "Wir haben dir eine E-Mail geschickt. Bitte bestätige deine Adresse über den Link darin, um dich anzumelden.",
    en: "We've sent you an email. Please confirm your address via the link in it to sign in.",
  },
  goToLogin: { de: "Zum Login", en: "Go to Login" },
} satisfies Record<string, Translated>;

// --- app/(auth)/reset-password (components/ResetPasswordForm.tsx) ------

export const resetPassword = {
  requestTitle: { de: "Passwort zurücksetzen", en: "Reset Password" },
  setNewTitle: { de: "Neues Passwort setzen", en: "Set New Password" },
  newPassword: { de: "Neues Passwort", en: "New Password" },
  newPasswordConfirm: { de: "Neues Passwort bestätigen", en: "Confirm New Password" },
  passwordMismatchError: {
    de: "Die Passwörter stimmen nicht überein.",
    en: "The passwords do not match.",
  },
  requestGenericError: { de: "Anfrage fehlgeschlagen.", en: "Request failed." },
  updateGenericError: {
    de: "Passwort konnte nicht gesetzt werden.",
    en: "Password could not be set.",
  },
  requestSuccess: {
    de: "Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail zum Zurücksetzen des Passworts verschickt.",
    en: "If an account exists for this email, a password reset email has been sent.",
  },
  sending: { de: "Wird gesendet…", en: "Sending…" },
  sendLink: { de: "Link zum Zurücksetzen senden", en: "Send Reset Link" },
  savingPassword: { de: "Wird gespeichert…", en: "Saving…" },
  savePassword: { de: "Passwort speichern", en: "Save Password" },
  backToLogin: { de: "Zurück zum Login", en: "Back to Login" },
} satisfies Record<string, Translated>;

// --- app/page.tsx (public homepage) ------------------------------------

export const home = {
  navFeatures: { de: "Funktionen", en: "Features" },
  navPricing: { de: "Preis", en: "Pricing" },
  navSignIn: { de: "Anmelden", en: "Sign In" },
  navSignUp: { de: "Registrieren", en: "Sign Up" },

  heroEyebrow: { de: "Läuft im Hintergrund", en: "Runs in the Background" },
  heroTitle: {
    de: "Zeit erfassen, ohne daran zu denken.",
    en: "Time tracking, without thinking about it.",
  },
  heroBody: {
    de: "TimTracker beobachtet Login, Sperren und Ruhezustand auf deinem Mac (Windows folgt) und erfasst deine Arbeitszeit automatisch — kein Start-/Stopp-Knopf, den du vergessen kannst. Welchem Projekt die Zeit gehört, ordnest du danach zu.",
    en: "TimTracker watches login, lock, and sleep on your Mac (Windows coming soon) and tracks your work time automatically — no start/stop button to forget. Which project the time belongs to, you assign afterwards.",
  },
  heroCtaStart: { de: "Kostenlos starten", en: "Start for Free" },
  heroCtaLogin: { de: "Anmelden", en: "Sign In" },
  heroTrialNote: {
    de: "7 Tage kostenlos · keine Kreditkarte nötig",
    en: "7 days free · no credit card required",
  },

  timelineWindowTitle: { de: "TimTracker — Heute", en: "TimTracker — Today" },
  timelineSegmentPresent: { de: "Anwesend", en: "Present" },
  timelineSegmentBreak: { de: "Pause", en: "Break" },
  timelineSegmentClient: { de: "Client X", en: "Client X" },
  timelineLoginTime: { de: "09:02 Login", en: "09:02 Login" },
  timelineSleepTime: { de: "18:47 Ruhezustand", en: "18:47 Sleep" },
  timelineLegendAuto: { de: "Automatisch erfasst", en: "Automatically tracked" },
  timelineLegendProject: { de: "Client X zugeordnet", en: "Assigned to Client X" },

  howItWorksTitle: { de: "So funktioniert's", en: "How It Works" },
  step1Title: { de: "Läuft automatisch", en: "Runs Automatically" },
  step1Body: {
    de: "Login, Wake, Sleep und Bildschirmsperre werden erfasst, sobald du am Rechner bist — ohne dass du etwas anklickst.",
    en: "Login, wake, sleep, and screen lock are tracked as soon as you're at your computer — without clicking anything.",
  },
  step2Title: { de: "Du ordnest zu", en: "You Assign It" },
  step2Body: {
    de: "Erfasste Zeit im Nachhinein einem Projekt oder Kunden zuweisen, in der App oder direkt im Web-Dashboard.",
    en: "Assign tracked time to a project or customer afterwards, in the app or directly in the web dashboard.",
  },
  step3Title: { de: "Du exportierst", en: "You Export It" },
  step3Body: {
    de: "Historie ansehen und den gewählten Zeitraum als CSV exportieren — für Excel, Numbers oder die Buchhaltung.",
    en: "View your history and export the selected period as CSV — for Excel, Numbers, or accounting.",
  },

  featuresTitle: { de: "Was TimTracker macht", en: "What TimTracker Does" },
  feature1Title: { de: "Automatisches Tracking", en: "Automatic Tracking" },
  feature1Body: {
    de: "Erfasst Anwesenheit anhand von Login, Wake/Sleep und Bildschirmsperre — kein manuelles Starten oder Stoppen nötig.",
    en: "Tracks presence based on login, wake/sleep, and screen lock — no manual starting or stopping needed.",
  },
  feature2Title: { de: "Projekte", en: "Projects" },
  feature2Body: {
    de: "Erfasste Zeit im Nachhinein einzelnen Projekten oder Kunden zuordnen, statt jede Session einzeln zu takten.",
    en: "Assign tracked time to individual projects or customers afterwards, instead of timing every session by hand.",
  },
  feature3Title: { de: "Historie & Export", en: "History & Export" },
  feature3Body: {
    de: "Vergangene Tage einsehen und den gewählten Zeitraum als CSV exportieren — passend für Excel, Numbers oder die Buchhaltung.",
    en: "Review past days and export the selected period as CSV — suited for Excel, Numbers, or accounting.",
  },
  feature4Title: { de: "Web-Dashboard", en: "Web Dashboard" },
  feature4Body: {
    de: "Heute-Übersicht, Historie, Projekte und Einstellungen auch im Browser abrufbar — mit demselben Account wie in der App.",
    en: "Today overview, history, projects, and settings also available in the browser — with the same account as the app.",
  },
  feature5Title: { de: "7 Tage kostenlos testen", en: "Try It Free for 7 Days" },
  feature5Body: {
    de: "Voller Funktionsumfang während der Testphase, danach ein einfaches Abo — jederzeit über die Einstellungen verwaltbar.",
    en: "Full functionality during the trial, then a simple subscription — manageable anytime via settings.",
  },

  pricingEyebrow: { de: "Preis", en: "Pricing" },
  pricingTitle: { de: "Ein Plan. Alles dabei.", en: "One Plan. Everything Included." },
  pricingBody: {
    de: "Kein Feature-Gating, keine Staffelung — voller Funktionsumfang ab dem ersten Tag.",
    en: "No feature gating, no tiers — full functionality from day one.",
  },
  pricingAmount: { de: "9,99 €", en: "€9.99" },
  pricingPeriod: { de: "/ Monat", en: "/ month" },
  pricingTrialNote: {
    de: "7 Tage kostenlos testen, danach monatlich kündbar",
    en: "7 days free, cancel anytime after",
  },
  pricingFeature1: { de: "Automatisches Tracking, Mac + Web", en: "Automatic tracking, Mac + Web" },
  pricingFeature2: { de: "Unbegrenzt Projekte & Kunden", en: "Unlimited projects & customers" },
  pricingFeature3: { de: "Historie mit Diagrammen, CSV & PDF-Export", en: "History with charts, CSV & PDF export" },
  pricingFeature4: { de: "Cloud-Sync zwischen App und Web", en: "Cloud sync between app and web" },
  pricingCta: { de: "Jetzt kostenlos testen", en: "Start Your Free Trial" },

  narrativeTag1: { de: "Für wen", en: "Who It's For" },
  narrativeHeading1: {
    de: "Gebaut für Freelancer und Entwickler, die das Tracken vergessen",
    en: "Built for freelancers and developers who forget to track",
  },
  narrativeBody1: {
    de: "Ein manueller Timer wird im Arbeitsalltag zuverlässig vergessen — beim Kunden-Call, beim Debuggen, beim Wechsel zwischen Projekten. TimTracker setzt deshalb nicht auf Disziplin, sondern erfasst Anwesenheit automatisch im Hintergrund, sobald du am Rechner bist.",
    en: "A manual timer reliably gets forgotten in everyday work — during a client call, while debugging, when switching between projects. TimTracker doesn't rely on discipline, it tracks presence automatically in the background as soon as you're at your computer.",
  },
  narrativeTag2: { de: "Ehrlich", en: "Honest" },
  narrativeHeading2: {
    de: "Automatik zuerst, Zuordnung im Nachhinein",
    en: "Automatic First, Assignment Afterwards",
  },
  narrativeBody2: {
    de: "Erfasst wird zunächst nur Anwesenheitszeit, keine App- oder Website-Nutzung. Welchem Projekt diese Zeit gehört, ordnest du danach zu — in der App oder direkt hier im Dashboard.",
    en: "Only presence time is tracked at first, never app or website usage. Which project this time belongs to, you assign afterwards — in the app or directly here in the dashboard.",
  },
  narrativeTag3: { de: "Plattformübergreifend", en: "Cross-Platform" },
  narrativeHeading3: { de: "Ein Account, App und Web", en: "One Account, App and Web" },
  narrativeBody3: {
    de: "Login, Historie und Projekte sind zwischen der macOS-App (Windows in Arbeit) und diesem Web-Dashboard synchron — derselbe Account, dieselben Daten, egal von wo du gerade draufschaust.",
    en: "Login, history, and projects stay in sync between the macOS app (Windows in progress) and this web dashboard — the same account, the same data, no matter where you're looking from.",
  },

  footerSupport: {
    de: "Fragen zu deinem Account? Erreichbar über die Support-Adresse in deiner Bestätigungs-E-Mail.",
    en: "Questions about your account? Reach us via the support address in your confirmation email.",
  },
} satisfies Record<string, Translated>;

// --- history/export/route.ts + history/export/pdf/route.ts -------------
// The 403 plain-text response a visitor sees if they follow the export
// link without an active trial/subscription. The generated file CONTENT
// itself (CSV columns, PDF body) deliberately stays German-only in this
// ticket — same scope decision the native app made in Ticket 004 (see
// its "Bewusst NICHT angefasst" section), which deferred export-label
// localization to its own follow-up ticket (015) rather than folding it
// into the UI-text pass. lib/format.ts#formatHistoryCsv and
// lib/pdf/history-export-document.tsx both still say so in their own
// comments.
export const exportGate = {
  noAccess: {
    de: "Kein aktiver Testzeitraum oder Abo mehr. Bitte Abo verwalten, um wieder auf deine Daten zuzugreifen.",
    en: "No active trial or subscription. Please manage your subscription to regain access to your data.",
  },
} satisfies Record<string, Translated>;
