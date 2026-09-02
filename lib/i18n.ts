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
  // Generic "action succeeded" confirmation (Ticket 042) — reused as the
  // toast message for any plain save action (display name, language
  // preference) instead of each one duplicating its own near-identical
  // "Saved." string. Was previously duplicated as profile.displayNameSaved
  // (same exact text) before this ticket unified it here.
  saved: { de: "Gespeichert.", en: "Saved." },
  // aria-label for a toast's manual-dismiss button (Ticket 042) — error
  // toasts stay until closed, success toasts auto-dismiss and never show
  // this button.
  close: { de: "Schließen", en: "Close" },
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
  analytics: { de: "Auswertung", en: "Analytics" },
  projects: { de: "Projekte", en: "Projects" },
  // Ticket 030 (TimTracker-Starter repo) — new nav entry, own icon (see
  // DashboardNav.tsx's SupportIcon), otherwise same flat-link treatment
  // as every other entry in NAV_LINKS.
  support: { de: "Support", en: "Support" },
  settings: { de: "Einstellungen", en: "Settings" },
  // Ticket 036: short label for the account-menu entry linking to
  // /dashboard/settings/billing — deliberately shorter than
  // billing.pageTitle ("Abo verwalten") / settings.manageSubscriptionLink
  // ("Abo verwalten →"), which both carry a trailing verb/arrow meant for
  // a full page title or an in-page link, not a compact dropdown item.
  billing: { de: "Abo", en: "Subscription" },
  logout: { de: "Logout", en: "Log Out" },
  loggingOut: { de: "Wird abgemeldet…", en: "Logging out…" },
  // Ticket 073: sidebar-collapse toggle button's aria-label/title — was a
  // duplicated `lang === "de" ? ... : ...` ternary (once per attribute)
  // before this ticket, moved here so both attributes resolve the same
  // translated string once instead of repeating the ternary.
  sidebarExpand: { de: "Seitenleiste einblenden", en: "Expand sidebar" },
  sidebarCollapse: { de: "Seitenleiste ausblenden", en: "Collapse sidebar" },
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
  // Ticket 033: label for a "pause" entry's segment/legend dot on the new
  // day timeline — pause time was previously only reachable as a flat list
  // row with no label of its own (its duration isn't part of any of the
  // three summary numbers above, see time-entries.repository.ts's
  // buildBreakdown: pauseSeconds is tracked but excluded from totalSeconds).
  pauseTime: { de: "Pause", en: "Pause" },
  entries: { de: "Einträge", en: "Entries" },
  running: { de: "läuft", en: "running" },
  // Ticket 044: hero-number progress add-on, only rendered when a daily
  // goal is set (lib/domain/daily-goal.ts#computeDailyGoalProgress). Short
  // aria-label for the progress bar itself — the "X von Y"/"X of Y" text
  // right next to it (dailyGoalProgressLabel below) is already the visible
  // equivalent, this just names the bar for a screen reader that announces
  // role="progressbar" separately from the text next to it.
  goalProgressAriaLabel: {
    de: "Fortschritt zum Tagesziel",
    en: "Progress toward daily goal",
  },
  // AK: "Ziel erreicht/überschritten: klar erkennbarer, aber ruhiger
  // visueller Zustand ... z. B. Balken voll + kurzer Zusatztext" — appended
  // after the "X von Y" text rather than replacing it, so the exact
  // reached value stays visible too.
  goalReached: { de: "Tagesziel erreicht", en: "Daily goal reached" },
  noEntriesToday: {
    de: "Noch keine Zeiteinträge für heute.",
    en: "No time entries for today yet.",
  },
  // Ticket 033: second line of the "Heute" empty state's now-two-line
  // explanation (AK: "was passiert automatisch, was muss der Nutzer selbst
  // tun") — noEntriesToday above stays the terse headline, this is the
  // added explanatory sentence, DayDetail renders both.
  noEntriesTodayDetail: {
    de: "Tiqloo erfasst deine Zeit automatisch, sobald du aktiv bist – dafür musst du nichts tun.",
    en: "Tiqloo tracks your time automatically while you're active — there's nothing you need to start yourself.",
  },
  noEntriesThisDay: {
    de: "Keine Zeiteinträge für diesen Tag.",
    en: "No time entries for this day.",
  },
  // Ticket 033: second line of the "Historie" day-detail empty state —
  // same two-line shape as noEntriesTodayDetail above, but phrased for a
  // past day (no forward-looking "tracking will start automatically"
  // framing, since the day is already over).
  noEntriesThisDayDetail: {
    de: "Für diesen Tag wurden weder automatische noch manuelle Zeiten aufgezeichnet.",
    en: "No automatic or manual time was recorded for this day.",
  },
  // Ticket 034: "Jetzt zuordnen" action, one per unassigned (kind "auto")
  // entry row in the entries list below the timeline — per-entry, not a
  // single whole-day action, per the ticket's own edge case (see
  // components/AssignTimeAction.tsx's header comment for the full
  // reasoning).
  assignAction: { de: "Jetzt zuordnen", en: "Assign now" },
  assignSelectLabel: { de: "Projekt auswählen", en: "Select project" },
  assignSelectPlaceholder: { de: "Projekt wählen…", en: "Choose a project…" },
  assignProjectsLoading: { de: "Projekte werden geladen…", en: "Loading projects…" },
  assignConfirm: { de: "Zuordnen", en: "Assign" },
  assignSuccess: { de: "Zeit wurde zugeordnet.", en: "Time has been assigned." },
  assignError: {
    de: "Zuordnung fehlgeschlagen. Bitte erneut versuchen.",
    en: "Assignment failed. Please try again.",
  },
  assignSelectRequiredError: {
    de: "Bitte ein Projekt auswählen.",
    en: "Please select a project.",
  },
  assignProjectsLoadError: {
    de: "Projekte konnten nicht geladen werden.",
    en: "Projects could not be loaded.",
  },
  // Shown instead of the select when the account has no real (non-system)
  // projects yet — assigning unassigned time to a project first requires
  // having at least one, same underlying list listProjects() (lib/
  // application/projects.ts) already filters to for the "Projekte" page.
  assignNoProjectsYet: {
    de: "Noch keine Projekte angelegt.",
    en: "No projects created yet.",
  },
  assignNoProjectsCta: { de: "Projekt anlegen", en: "Create project" },
} satisfies Record<string, Translated>;

// Native `title` tooltip for one segment on the new day timeline (Ticket
// 033) — same "exact value on hover" precedent as historyChartTooltip
// below, but no `lang` param needed: unlike that helper's template (word
// order differs between "Automatik X, Projekt Y" / "Automatic X, Project
// Y"), every piece here is already a fully localized string the caller
// passes in, so the template shape itself is language-neutral.
export function dayDetailSegmentTooltip(
  kindLabel: string,
  startLabel: string,
  endLabel: string,
  durationLabel: string,
): string {
  return `${kindLabel}: ${startLabel}–${endLabel} (${durationLabel})`;
}

// Ticket 044: the hero number's goal-progress caption — AK's own example,
// "6 h 42 min von 8 h". Both labels are already fully formatted duration
// strings (formatDuration) the caller passes in, same "template is
// language-neutral once every piece is pre-localized" precedent as
// dayDetailSegmentTooltip just above.
export function dailyGoalProgressLabel(lang: Lang, actualLabel: string, goalLabel: string): string {
  return lang === "de" ? `${actualLabel} von ${goalLabel}` : `${actualLabel} of ${goalLabel}`;
}

// --- components/HistoryChart.tsx -------------------------------------

export const historyChart = {
  automaticTime: { de: "Automatikzeit", en: "Automatic time" },
  projectTime: { de: "Projektzeit", en: "Project time" },
  dailyValues: { de: "Tageswerte", en: "Daily values" },
  monthlyValues: {
    de: "Monatswerte (aggregiert)",
    en: "Monthly values (aggregated)",
  },
  // Ticket 043: shown next to the granularity label when the "Historie"
  // project filter is active, so the chart itself makes clear it's
  // showing one project's bars, not the whole period's activity — not
  // just a silent difference in bar height a user might mistake for a
  // quiet day.
  filteredByProjectPrefix: { de: "Projekt:", en: "Project:" },
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
  // Ticket 039: distinct from noProjectsYet above — this is the empty
  // state for "the search term matched nothing", not "there are no
  // projects at all". Shown only while a search term is active, so a user
  // never sees a bare, unexplained empty list (ticket's own edge case).
  noSearchResults: { de: "Keine Projekte gefunden.", en: "No projects found." },
  searchLabel: { de: "Suchen", en: "Search" },
  searchPlaceholder: {
    de: "Name oder Kunde suchen…",
    en: "Search name or customer…",
  },
  sortLabel: { de: "Sortieren nach", en: "Sort by" },
  sortByRecentOption: { de: "Zuletzt aktualisiert", en: "Last updated" },
  sortByNameOption: { de: "Name (A–Z)", en: "Name (A–Z)" },
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
  // Ticket 042 toast success copy — createProject/renameProject already had
  // an *Error counterpart above; archive/unarchive previously had no
  // success feedback at all (the ticket's whole reason for existing), so
  // these two are genuinely new rather than a duplicate of anything.
  createSuccess: { de: "Projekt wurde angelegt.", en: "Project was created." },
  saveSuccess: { de: "Projekt wurde gespeichert.", en: "Project was saved." },
  archiveSuccess: { de: "Projekt wurde archiviert.", en: "Project was archived." },
  reactivateSuccess: { de: "Projekt wurde reaktiviert.", en: "Project was reactivated." },
} satisfies Record<string, Translated>;

// --- app/(dashboard)/dashboard/page.tsx ("Heute") --------------------

export const today = {
  pageTitle: { de: "Heute", en: "Today" },
  goToHistory: { de: "Zur Historie →", en: "Go to History →" },
} satisfies Record<string, Translated>;

// --- app/(dashboard)/dashboard/history/page.tsx -----------------------

export const history = {
  pageTitle: { de: "Historie", en: "History" },
  analyticsTitle: { de: "Auswertung", en: "Analytics" },
  analyticsDescription: { de: "Arbeitszeiten, Trends und Projektanteile auf einen Blick.", en: "Working time, trends, and project shares at a glance." },
  periodOverview: { de: "Zeitraum im Überblick", en: "Period overview" },
  totalHours: { de: "Arbeitszeit gesamt", en: "Total working time" },
  averagePerDay: { de: "Ø pro aktivem Tag", en: "Average per active day" },
  projectCount: { de: "Projekte mit Arbeitszeit", en: "Projects with tracked time" },
  calendarView: { de: "Arbeitskalender", en: "Work calendar" },
  workTimeTrend: { de: "Arbeitszeit-Verlauf", en: "Working-time trend" },
  projectOverview: { de: "Zeit nach Projekten", en: "Time by project" },
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
  // Ticket 043 edge case: project filter + period together yield zero
  // days — shown INSTEAD of noActivity above whenever a project filter is
  // active, so the empty state clearly says "this filter" rather than
  // leaving the user wondering if the whole period is genuinely empty.
  noActivityFiltered: {
    de: "Keine Einträge für diesen Filter.",
    en: "No entries for this filter.",
  },
  automatic: { de: "Automatik", en: "Automatic" },
  project: { de: "Projekt", en: "Project" },
  unassigned: { de: "Nicht zugeordnet", en: "Unassigned" },
  backToHistory: { de: "← Zurück zur Historie", en: "← Back to History" },
  // --- Ticket 043: calendar range picker + project filter ---------------
  allProjects: { de: "Alle Projekte", en: "All Projects" },
  chooseRange: { de: "Zeitraum wählen", en: "Choose period" },
  previousMonth: { de: "Vorheriger Monat", en: "Previous month" },
  nextMonth: { de: "Nächster Monat", en: "Next month" },
  calendarLabel: { de: "Kalender", en: "Calendar" },
} satisfies Record<string, Translated>;

// Ticket 073: weekday abbreviations for the work calendar's header row
// (components/HistoryWorkCalendar.tsx). Not part of the `history` object
// above — its values are string[], not the single {de,en} string pair
// `Translated`/`t()` expect (same reason helpcenter.faqs/changelog.entries
// live as their own top-level consts rather than inside a `satisfies
// Record<string, Translated>` object) — but stays in this file section
// since it belongs to the same component/namespace.
export const historyWeekdayAbbreviations: { de: string[]; en: string[] } = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

// --- components/SettingsClient.tsx: ProfileSection (Ticket 024) --------

export const profile = {
  sectionTitle: { de: "Profil", en: "Profile" },
  displayNameLabel: { de: "Anzeigename", en: "Display Name" },
  displayNameOptionalHint: { de: "optional", en: "optional" },
  displayNameSaveError: {
    de: "Anzeigename konnte nicht gespeichert werden.",
    en: "Display name could not be saved.",
  },
  // Toast success text for a display-name save now reuses common.saved
  // (Ticket 042) — this used to have its own identical "Gespeichert."/
  // "Saved." entry here, removed as a duplicate.
  emailLabel: { de: "E-Mail-Adresse", en: "Email Address" },
  createdAtLabel: { de: "Konto erstellt am", en: "Account Created" },
  // Ticket 032: small subtitle above EmailChangeAction/PasswordChangeAction,
  // marking that sub-section as security-sensitive (visually via
  // bg-paper/border-line, see SettingsClient.tsx) without red/destructive
  // styling — that stays reserved for DeleteAccountSection below.
  securitySectionTitle: { de: "Sicherheit", en: "Security" },
  // --- EmailChangeSection (Ticket 025, follow-up to 024) ---------------
  emailChangeButton: { de: "E-Mail-Adresse ändern…", en: "Change Email Address…" },
  emailChangeIntro: {
    de: "Aus Sicherheitsgründen bitte das aktuelle Passwort bestätigen.",
    en: "For security, please confirm your current password.",
  },
  emailChangeNewEmailLabel: { de: "Neue E-Mail-Adresse", en: "New Email Address" },
  emailChangeCurrentPasswordLabel: { de: "Aktuelles Passwort", en: "Current Password" },
  emailChangeSubmit: { de: "Bestätigungs-E-Mails senden", en: "Send Confirmation Emails" },
  emailChangeSending: { de: "Wird gesendet…", en: "Sending…" },
  // Deliberately generic (does not say "already registered to another
  // account") — anti-enumeration, see
  // lib/repositories/auth.repository.ts#EmailAlreadyInUseError's comment.
  emailAlreadyInUseError: {
    de: "Diese E-Mail-Adresse kann nicht verwendet werden.",
    en: "This email address cannot be used.",
  },
  emailChangeWrongPasswordError: { de: "Passwort ist falsch.", en: "Password is incorrect." },
  emailChangeGenericError: {
    de: "E-Mail-Adresse konnte nicht geändert werden.",
    en: "Email address could not be changed.",
  },
  // --- PasswordChangeAction (Ticket 026, follow-up to 024/025) ---------
  passwordChangeButton: { de: "Passwort ändern…", en: "Change Password…" },
  passwordChangeCurrentPasswordLabel: { de: "Aktuelles Passwort", en: "Current Password" },
  passwordChangeNewPasswordLabel: { de: "Neues Passwort", en: "New Password" },
  passwordChangeConfirmLabel: {
    de: "Neues Passwort bestätigen",
    en: "Confirm New Password",
  },
  passwordChangeSubmit: { de: "Passwort ändern", en: "Change Password" },
  passwordChangeSending: { de: "Wird geändert…", en: "Changing…" },
  // Client-side only (no server roundtrip) — checked before changePassword()
  // is ever called, same text as resetPassword.passwordMismatchError below
  // but its own key since this namespace already keeps every profile-form
  // string self-contained (see emailChange* above, which duplicates rather
  // than reaches into other namespaces).
  passwordChangeMismatchError: {
    de: "Die Passwörter stimmen nicht überein.",
    en: "The passwords do not match.",
  },
  // Deliberately says "current password" (unlike
  // emailChangeWrongPasswordError's plain "Passwort ist falsch.") — this
  // form has two password fields, so the generic phrasing would be
  // ambiguous about which one was wrong.
  passwordChangeWrongPasswordError: {
    de: "Aktuelles Passwort ist falsch.",
    en: "Current password is incorrect.",
  },
  passwordChangeGenericError: {
    de: "Passwort konnte nicht geändert werden.",
    en: "Password could not be changed.",
  },
  passwordChangeSuccess: {
    de: "Passwort erfolgreich geändert.",
    en: "Password changed successfully.",
  },
} satisfies Record<string, Translated>;

// Ticket 025: the AK's required success copy — "Bestätigungs-E-Mails an
// [alte] und [neue Adresse] gesendet — die Änderung wird erst nach
// Bestätigung beider wirksam." Interpolated (needs both addresses), so a
// function rather than a static Translated entry, same pattern as
// trialDaysRemainingParts/historyChartTooltip above. Reflects the double-
// confirmation behavior verified ON for both the local Docker stack and
// production before this was written (see
// docs/tickets/025-profile-email-change.md).
export function emailChangeSuccessMessage(
  lang: Lang,
  oldEmail: string,
  newEmail: string,
): string {
  return lang === "de"
    ? `Bestätigungs-E-Mails an ${oldEmail} und ${newEmail} gesendet — die Änderung wird erst nach Bestätigung beider wirksam.`
    : `Confirmation emails sent to ${oldEmail} and ${newEmail} — the change only takes effect once both are confirmed.`;
}

// --- app/(dashboard)/dashboard/settings/page.tsx + SettingsClient.tsx --

export const settings = {
  pageTitle: { de: "Einstellungen", en: "Settings" },
  // Ticket 073: description paragraph under the "Einstellungen" heading —
  // was a hardcoded `lang === "de" ? ... : ...` ternary in page.tsx.
  pageDescription: {
    de: "Verwalte dein Profil, deine persönlichen Präferenzen und alle Kontoeinstellungen an einem Ort.",
    en: "Manage your profile, personal preferences, and account settings in one place.",
  },
  manageSubscriptionLink: { de: "Abo verwalten →", en: "Manage Subscription →" },
  // Ticket 041: heading for the new compact subscription overview card
  // that replaces the previous bare manageSubscriptionLink text link on
  // the main settings page — see SettingsClient.tsx's SubscriptionSection.
  subscriptionSectionTitle: { de: "Abo", en: "Subscription" },
  languageSectionTitle: { de: "Sprache", en: "Language" },
  designSectionTitle: { de: "Design", en: "Appearance" },
  designSectionBody: {
    de: "Wähle, wie Tiqloo für dich aussehen soll.",
    en: "Choose how Tiqloo should look for you.",
  },
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
  // "Tägliches Ziel" (Ticket 044, TimTracker-Starter repo — follow-up to
  // 033) — new Settings section placed right after LanguageSection (see
  // SettingsClient.tsx), same "near Profil/Sprache" grouping the ticket's
  // AK asks for. Optional: blank/0 -> no goal, see
  // lib/domain/daily-goal.ts#normalizeDailyGoalHoursInput.
  dailyGoalSectionTitle: { de: "Tägliches Ziel", en: "Daily Goal" },
  dailyGoalLabel: { de: "Tägliches Ziel (Stunden)", en: "Daily Goal (Hours)" },
  dailyGoalHint: {
    de: "Optional — leer lassen oder 0 für kein Ziel. Erlaubt sind 0–24 Stunden.",
    en: "Optional — leave empty or 0 for no goal. Allowed range is 0–24 hours.",
  },
  dailyGoalSaveError: {
    de: "Tägliches Ziel konnte nicht gespeichert werden.",
    en: "Daily goal could not be saved.",
  },
  // "Meine Daten exportieren" (Ticket 046, TimTracker-Starter repo) —
  // DSGVO/GDPR Art. 20 data-portability action, placed directly above
  // deleteAccountTitle below (see SettingsClient.tsx's DataExportSection):
  // both are "Konto-Grundrechte" (Art. 17 vs. Art. 20) and belong next to
  // each other, same reasoning as that ticket's own "Ausgangslage".
  dataExportTitle: { de: "Meine Daten exportieren", en: "Export My Data" },
  dataExportBody: {
    de: "Lädt alle über dich gespeicherten Daten (Profil, Projekte inkl. archivierter, alle Zeiteinträge, Abo-Status) als eine JSON-Datei herunter — dein Recht auf Datenübertragbarkeit (DSGVO Art. 20).",
    en: "Downloads everything stored about you (profile, projects incl. archived, all time entries, subscription status) as one JSON file — your right to data portability (GDPR Art. 20).",
  },
  dataExportButton: { de: "Daten exportieren", en: "Export Data" },
  dataExportPending: { de: "Wird exportiert…", en: "Exporting…" },
  dataExportSuccess: {
    de: "Datenexport heruntergeladen.",
    en: "Data export downloaded.",
  },
  dataExportError: {
    de: "Datenexport fehlgeschlagen.",
    en: "Data export failed.",
  },
  // Ticket 041: replaces the old, always-red "Account löschen" heading —
  // the section itself is now titled neutrally as a "Gefahrenbereich"
  // (danger zone) so it no longer reads as more prominent/alarming than
  // any other card until the user actually starts the delete flow. See
  // SettingsClient.tsx's DeleteAccountSection.
  dangerZoneTitle: { de: "Gefahrenbereich", en: "Danger Zone" },
  // One-sentence explanation shown in the collapsed/default state (AK,
  // Ticket 041) — the fuller deleteAccountBody text below is only shown
  // once the user has clicked through to the actual confirmation step.
  dangerZoneIntro: {
    de: "Unwiderrufliche Kontoaktion.",
    en: "An irreversible account action.",
  },
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

export const themeLabels = {
  system: { de: "System", en: "System" },
  light: { de: "Hell", en: "Light" },
  dark: { de: "Dunkel", en: "Dark" },
} satisfies Record<"system" | "light" | "dark", Translated>;

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

// --- app/(dashboard)/dashboard/support (components/SupportClient.tsx) --
// Ticket 030 (TimTracker-Starter repo) — new "Support" page. Deliberately
// mailto:-based for V1 (no new form/Edge Function, no new dependency):
// docs/audit-findings.md's open "kein Custom-SMTP für das
// Produktions-Supabase-Projekt konfiguriert" finding means a Supabase-
// Auth-mailer-backed form would be unreliable right now (built-in mailer
// rate-limited to ~3-4 mails/hour, silently fails above that since the
// API always returns 200 for anti-enumeration reasons) — a real Edge
// Function alternative doesn't share that specific limit but is still
// more moving parts than this ticket's AK asks for as the V1 default.
// SUPPORT_EMAIL below is a clearly-marked placeholder (tiqloo.com is the
// real production domain per TimTracker-Web/README.md's "Produktions-
// Deployment" section, but this exact mailbox has NOT been confirmed to
// exist/receive mail by a human) — flagged in this ticket's report,
// replace with the real address before shipping.
export const support = {
  pageTitle: { de: "Support", en: "Support" },
  // Split around the interpolated display name — see SupportClient.tsx's
  // greeting, same "prefix/name/suffix" split as DashboardNav.tsx uses
  // for the identical truncate-long-name requirement (Ticket 030 Edge
  // Cases: "gleiche truncate-Regel wie in der Nav").
  greetingSuffix: { de: ", wobei können wir dir helfen?", en: ", how can we help you?" },
  requestTitle: { de: "Neue Anfrage", en: "New Request" },
  requestLabel: { de: "Beschreibe dein Anliegen", en: "Describe your request" },
  requestPlaceholder: { de: "Wobei brauchst du Hilfe?", en: "What do you need help with?" },
  requestSubmit: { de: "Anfrage per E-Mail senden", en: "Send Request via Email" },
  // Edge case (ticket AK): "Absenden ohne konfigurierten Mail-Client ->
  // Nutzer sieht zumindest die Ziel-Adresse als sichtbaren Text daneben,
  // nicht nur als unsichtbaren Link-Href" — requestSendsTo + the visible
  // address next to the button satisfy that.
  requestSendsTo: { de: "Wird gesendet an:", en: "Will be sent to:" },
  requestFallbackHint: {
    de: "Öffnet dein E-Mail-Programm mit einer vorausgefüllten Nachricht. Falls sich nichts öffnet, schreib uns direkt an die Adresse oben.",
    en: "Opens your email app with a pre-filled message. If nothing opens, write to the address above directly.",
  },
  requestMailSubject: { de: "Tiqloo Support-Anfrage", en: "Tiqloo Support Request" },
  quickLinksTitle: { de: "Schnellzugriffe", en: "Quick Links" },
  feedbackTitle: { de: "Feedback teilen", en: "Share Feedback" },
  feedbackBody: {
    de: "Idee, Kritik oder Lob — wir lesen jede Nachricht.",
    en: "Idea, criticism, or praise — we read every message.",
  },
  feedbackMailSubject: { de: "Tiqloo Feedback", en: "Tiqloo Feedback" },
  // "Kontoinhaber" from the Personio reference is deliberately NOT
  // ported (B2B-only concept, no equivalent in TimTracker's one-person
  // accounts, see the ticket's AK) — this settings quick link is the
  // suggested replacement the ticket names instead.
  settingsQuickLinkTitle: { de: "Einstellungen", en: "Settings" },
  settingsQuickLinkBody: {
    de: "Profil, Sprache, Abo und Account verwalten.",
    en: "Manage profile, language, subscription, and account.",
  },
  footerHelpcenter: { de: "Helpcenter", en: "Help Center" },
  footerChangelog: { de: "Produkt-Neuerungen", en: "What's New" },
} satisfies Record<string, Translated>;

// --- app/(dashboard)/dashboard/support/helpcenter -----------------------
// Static FAQ page (Ticket 030). Every answer below names a feature that
// has actually shipped (grounded against docs/tickets/README.md and the
// live code, not invented) — CSV/PDF export (021/002/018), Stripe
// customer-portal cancellation (007), email/password change (025/026),
// language switching (018 Phase 1e/022), account deletion (018 Phase 1e).
export interface FaqEntry {
  question: Translated;
  answer: Translated;
}

export const helpcenter = {
  pageTitle: { de: "Helpcenter", en: "Help Center" },
  backToSupport: { de: "← Zurück zu Support", en: "← Back to Support" },
  intro: {
    de: "Antworten auf häufige Fragen zu Tiqloo.",
    en: "Answers to common questions about Tiqloo.",
  },
  faqs: [
    {
      question: { de: "Wie exportiere ich meine erfassten Zeiten?", en: "How do I export my tracked time?" },
      answer: {
        de: "Auf der Historie-Seite wählst du den gewünschten Zeitraum und exportierst ihn oben rechts als CSV oder PDF — passend für Excel, Numbers oder die Buchhaltung.",
        en: "On the History page, pick the period you want and export it at the top as CSV or PDF — suited for Excel, Numbers, or accounting.",
      },
    },
    {
      question: { de: "Wie kündige ich mein Abo?", en: "How do I cancel my subscription?" },
      answer: {
        de: "Öffne Einstellungen → \"Abo verwalten\". Das führt dich zum Stripe-Kundenportal, wo du dein Abo jederzeit selbst kündigen oder deine Zahlungsmethode ändern kannst.",
        en: "Open Settings → \"Manage Subscription\". This takes you to the Stripe customer portal, where you can cancel your subscription or update your payment method at any time.",
      },
    },
    {
      question: { de: "Wie ändere ich meine E-Mail-Adresse?", en: "How do I change my email address?" },
      answer: {
        de: "In Einstellungen → Profil → \"E-Mail-Adresse ändern…\" gibst du die neue Adresse und dein aktuelles Passwort ein. Wir schicken Bestätigungslinks an die alte UND die neue Adresse — die Änderung wirkt erst, sobald beide bestätigt sind.",
        en: "In Settings → Profile → \"Change Email Address…\", enter the new address and your current password. We send confirmation links to both the old AND new address — the change only takes effect once both are confirmed.",
      },
    },
    {
      question: { de: "Wie ändere ich mein Passwort?", en: "How do I change my password?" },
      answer: {
        de: "In Einstellungen → Profil → \"Passwort ändern…\" gibst du dein aktuelles und ein neues Passwort ein. Die Änderung wirkt sofort, du bleibst eingeloggt.",
        en: "In Settings → Profile → \"Change Password…\", enter your current and a new password. The change takes effect immediately, you stay logged in.",
      },
    },
    {
      question: { de: "Kann ich die Sprache der Oberfläche ändern?", en: "Can I change the interface language?" },
      answer: {
        de: "Ja — in Einstellungen kannst du zwischen Deutsch und Englisch wechseln. Der Wechsel wirkt sofort auf die gesamte Oberfläche, inklusive Datumsformaten.",
        en: "Yes — in Settings you can switch between German and English. The change takes effect immediately across the whole interface, including date formats.",
      },
    },
    {
      question: {
        de: "Kann ich Tiqloo auch im Browser nutzen, nicht nur auf dem Mac?",
        en: "Can I use Tiqloo in the browser, not just on the Mac?",
      },
      answer: {
        de: "Ja — auf tiqloo.com meldest du dich mit demselben Account wie in der Mac-App an und siehst Heute, Historie, Projekte und Einstellungen direkt im Browser.",
        en: "Yes — at tiqloo.com you sign in with the same account as in the Mac app and see Today, History, Projects, and Settings directly in your browser.",
      },
    },
    {
      question: { de: "Wie lösche ich meinen Account?", en: "How do I delete my account?" },
      answer: {
        de: "Ganz unten in Einstellungen findest du \"Account löschen…\". Das löscht deinen Account und alle Cloud-Daten (Projekte, Zeiteinträge, Abo) unwiderruflich — lokale Daten auf deinen Geräten bleiben unangetastet.",
        en: "At the bottom of Settings you'll find \"Delete Account…\". This permanently deletes your account and all cloud data (projects, time entries, subscription) — local data on your devices stays untouched.",
      },
    },
  ] satisfies FaqEntry[],
} as const;

// --- app/(dashboard)/dashboard/support/changelog -------------------------
// Static "Produkt-Neuerungen" page (Ticket 030). Every entry below is a
// real, already-shipped web feature, dated/ticket-numbered from
// docs/tickets/README.md — not invented placeholder copy. Newest first.
export interface ChangelogEntry {
  date: string;
  ticket: string;
  title: Translated;
  body: Translated;
}

export const changelog = {
  pageTitle: { de: "Produkt-Neuerungen", en: "What's New" },
  backToSupport: { de: "← Zurück zu Support", en: "← Back to Support" },
  entries: [
    {
      date: "2026-09-01",
      ticket: "027",
      title: { de: "Sicherheits-Header", en: "Security Headers" },
      body: {
        de: "Die Verbindung zu Tiqloo ist jetzt zusätzlich per Content-Security-Policy und weiteren Sicherheits-Headern abgesichert.",
        en: "The connection to Tiqloo is now additionally secured with a Content Security Policy and other security headers.",
      },
    },
    {
      date: "2026-08-31",
      ticket: "026",
      title: { de: "Passwort ändern", en: "Change Password" },
      body: {
        de: "Passwort direkt in den Einstellungen ändern, ganz ohne Log-out.",
        en: "Change your password directly in Settings, no log-out required.",
      },
    },
    {
      date: "2026-08-31",
      ticket: "025",
      title: { de: "E-Mail-Adresse ändern", en: "Change Email Address" },
      body: {
        de: "E-Mail-Adresse in den Einstellungen ändern, mit Bestätigung an die alte und die neue Adresse.",
        en: "Change your email address in Settings, confirmed via both the old and new address.",
      },
    },
    {
      date: "2026-08-31",
      ticket: "024",
      title: { de: "Profil: Anzeigename", en: "Profile: Display Name" },
      body: {
        de: "Neuer Profil-Bereich in den Einstellungen mit einstellbarem Anzeigenamen.",
        en: "New profile section in Settings with an editable display name.",
      },
    },
    {
      date: "2026-08-31",
      ticket: "022",
      title: { de: "Zweisprachige Oberfläche", en: "Bilingual Interface" },
      body: {
        de: "Die gesamte Web-Oberfläche ist jetzt auf Deutsch und Englisch verfügbar.",
        en: "The entire web interface is now available in German and English.",
      },
    },
    {
      date: "2026-08-31",
      ticket: "021",
      title: { de: "PDF-Export", en: "PDF Export" },
      body: {
        de: "Historie zusätzlich zu CSV jetzt auch als PDF exportierbar.",
        en: "History can now be exported as PDF, in addition to CSV.",
      },
    },
    {
      date: "2026-08-26",
      ticket: "018",
      title: { de: "Öffentliche Website", en: "Public Website" },
      body: {
        de: "Neue öffentliche Startseite unter tiqloo.com mit Funktionsübersicht und Preis.",
        en: "New public homepage at tiqloo.com with a feature overview and pricing.",
      },
    },
    {
      date: "2026-08-25",
      ticket: "018",
      title: { de: "Web-Dashboard gestartet", en: "Web Dashboard Launched" },
      body: {
        de: "Anmeldung, Heute-Übersicht, Historie, Projekte und Einstellungen jetzt auch im Browser — mit demselben Account wie in der Mac-App.",
        en: "Sign-in, Today overview, History, Projects, and Settings now also in the browser — with the same account as the Mac app.",
      },
    },
  ] satisfies ChangelogEntry[],
} as const;

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

// --- app/(dashboard)/dashboard/get-started ---------------------------

export const onboarding = {
  eyebrow: { de: "ERSTE SCHRITTE", en: "GET STARTED" },
  title: { de: "Tiqloo einrichten", en: "Set up Tiqloo" },
  intro: {
    de: "Dein Konto ist bereit. Verbinde jetzt die Mac-App, damit deine Arbeitszeit automatisch im Web erscheint.",
    en: "Your account is ready. Connect the Mac app so your work time appears on the web automatically.",
  },
  progress: { de: "Einrichtungsfortschritt", en: "Setup progress" },
  accountTitle: { de: "Konto bestätigt", en: "Account confirmed" },
  accountBody: { de: "Angemeldet als", en: "Signed in as" },
  downloadTitle: { de: "Mac-App laden", en: "Download the Mac app" },
  downloadBody: {
    de: "Lade ausschließlich die aktuelle, signierte Testversion herunter.",
    en: "Only download the current signed beta version.",
  },
  downloadAction: { de: "Tiqloo für macOS laden", en: "Download Tiqloo for macOS" },
  downloadUnavailable: {
    de: "Der geprüfte Mac-Download wird gerade vorbereitet. Wir schalten ihn erst frei, wenn Signatur und Notarisierung bestätigt sind.",
    en: "The verified Mac download is being prepared. It will only be enabled after signing and notarization are confirmed.",
  },
  installTitle: { de: "Installieren und anmelden", en: "Install and sign in" },
  installBody: {
    de: "Öffne Tiqloo und melde dich mit derselben E-Mail-Adresse an. Aktiviere anschließend die benötigten macOS-Berechtigungen.",
    en: "Open Tiqloo and sign in with the same email address. Then enable the required macOS permissions.",
  },
  syncTitle: { de: "Ersten Eintrag synchronisieren", en: "Sync your first entry" },
  syncPending: {
    de: "Sobald Tiqloo Aktivität erfasst, erscheint der erste Eintrag automatisch hier.",
    en: "As soon as Tiqloo records activity, your first entry will appear here automatically.",
  },
  syncDone: {
    de: "Der erste Zeiteintrag ist angekommen. Tiqloo ist verbunden.",
    en: "Your first time entry has arrived. Tiqloo is connected.",
  },
  openToday: { de: "Zur Heute-Übersicht", en: "Open Today" },
  trialPrefix: { de: "Deine Testphase läuft noch", en: "Your trial has" },
  trialSuffix: { de: "Tage.", en: "days remaining." },
  done: { de: "Erledigt", en: "Done" },
  next: { de: "Als Nächstes", en: "Next" },
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
  navPrimaryLabel: { de: "Hauptnavigation", en: "Primary navigation" },
  navAbout: { de: "Das ist Tiqloo", en: "About Tiqloo" },
  navFeatures: { de: "Funktionen", en: "Features" },
  navPricing: { de: "Preis", en: "Pricing" },
  navSignIn: { de: "Anmelden", en: "Sign In" },
  navSignUp: { de: "Registrieren", en: "Sign Up" },
  navTryTiqloo: { de: "Tiqloo ausprobieren", en: "Try Tiqloo" },
  socialLabel: { de: "Tiqloo in sozialen Medien", en: "Tiqloo on social media" },
  socialUnavailable: { de: "Bald verfügbar", en: "Coming soon" },

  heroEyebrow: { de: "Läuft im Hintergrund", en: "Runs in the Background" },
  heroTitle: {
    de: "Zeit erfassen, ohne daran zu denken.",
    en: "Time tracking, without thinking about it.",
  },
  heroBody: {
    de: "Tiqloo beobachtet Login, Sperren und Ruhezustand auf deinem Mac (Windows folgt) und erfasst deine Arbeitszeit automatisch — kein Start-/Stopp-Knopf, den du vergessen kannst. Welchem Projekt die Zeit gehört, ordnest du danach zu.",
    en: "Tiqloo watches login, lock, and sleep on your Mac (Windows coming soon) and tracks your work time automatically — no start/stop button to forget. Which project the time belongs to, you assign afterwards.",
  },
  heroCtaStart: { de: "Kostenlos starten", en: "Start for Free" },
  heroCtaLogin: { de: "Anmelden", en: "Sign In" },
  heroTrialNote: {
    de: "7 Tage kostenlos · keine Kreditkarte nötig",
    en: "7 days free · no credit card required",
  },

  timelineWindowTitle: { de: "Tiqloo — Heute", en: "Tiqloo — Today" },
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

  featuresTitle: { de: "Was Tiqloo macht", en: "What Tiqloo Does" },
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

  downloadEyebrow: { de: "Desktop-App", en: "Desktop app" },
  downloadTitle: { de: "Tiqloo für Mac", en: "Tiqloo for Mac" },
  downloadBody: {
    de: "Lade die signierte und von Apple geprüfte Tiqloo-App herunter. Öffne danach das DMG und ziehe Tiqloo in den Programme-Ordner.",
    en: "Download the signed and Apple-notarized Tiqloo app. Then open the DMG and drag Tiqloo into Applications.",
  },
  downloadAction: { de: "Für Mac herunterladen", en: "Download for Mac" },
  downloadVersion: { de: "Version", en: "Version" },
  downloadRequirement: { de: "Voraussetzung", en: "Requirement" },
  downloadSize: { de: "Größe", en: "Size" },
  downloadUnavailable: {
    de: "Der sichere Mac-Download wird gerade signiert und von Apple geprüft. Er erscheint hier automatisch, sobald die Freigabe abgeschlossen ist.",
    en: "The secure Mac download is currently being signed and verified by Apple. It will appear here automatically once release approval is complete.",
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
    de: "Ein manueller Timer wird im Arbeitsalltag zuverlässig vergessen — beim Kunden-Call, beim Debuggen, beim Wechsel zwischen Projekten. Tiqloo setzt deshalb nicht auf Disziplin, sondern erfasst Anwesenheit automatisch im Hintergrund, sobald du am Rechner bist.",
    en: "A manual timer reliably gets forgotten in everyday work — during a client call, while debugging, when switching between projects. Tiqloo doesn't rely on discipline, it tracks presence automatically in the background as soon as you're at your computer.",
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
