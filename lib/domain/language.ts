// Domain model — mirrors Domain/Enums/AppLanguage.swift in
// TimTracker-Starter (Ticket 004): "system" follows the visitor's
// preferred language (German if their first preference is German, English
// as the fallback otherwise — same rule as AppLanguage.resolveSystemLanguageCode,
// just fed by the browser's Accept-Language header instead of macOS's
// Locale.preferredLanguages); "de"/"en" are explicit, persisted overrides
// that always win once set.
//
// SCOPE NOTE (Ticket 018, Phase 1e): this is the language SETTING only —
// storage, resolution, <html lang>, and this app's own new date/number
// formatting. It deliberately does NOT translate the existing German-only
// UI strings across app/(dashboard)/* and app/(auth)/* (15+ pages built in
// Phases 1a-1d). Full bilingual UI text is a separate, much larger
// undertaking (every string in every page would need an EN variant plus a
// lookup mechanism, mirroring Resources/Localizable.xcstrings on the
// native side) that was explicitly out of scope for "implement the
// settings page" — see the Phase 1e section of
// TimTracker-Starter/docs/tickets/018-account-website.md for the full
// reasoning. What IS real here: the preference is stored, visible, and
// drives the actual <html lang> attribute (app/layout.tsx) and this
// phase's own date formatting (Settings/Billing pages) via Intl.
export type AppLanguage = "system" | "de" | "en";

export const APP_LANGUAGES: AppLanguage[] = ["system", "de", "en"];

// Resolves an AppLanguage preference to a concrete "de" | "en" code for a
// given request, mirroring AppLanguage.swift's
// effectiveLanguageCode(preferredLanguages:)/resolveSystemLanguageCode(preferredLanguages:)
// 1:1 in spirit: explicit overrides win outright, "system" defers to the
// visitor's first preferred language, German only if THAT starts with
// "de", English as the fallback for everything else (including no header
// at all). `acceptLanguageHeader` is the raw `Accept-Language` request
// header (e.g. "de-DE,de;q=0.9,en;q=0.8") — the web equivalent of
// `Locale.preferredLanguages`'s first entry.
export function resolveLanguageCode(
  language: AppLanguage,
  acceptLanguageHeader: string | null,
): "de" | "en" {
  switch (language) {
    case "de":
      return "de";
    case "en":
      return "en";
    case "system":
      return resolveSystemLanguageCode(acceptLanguageHeader);
  }
}

export function resolveSystemLanguageCode(acceptLanguageHeader: string | null): "de" | "en" {
  const first = acceptLanguageHeader?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("de") ? "de" : "en";
}

// "de" -> "de-DE", "en" -> "en-US" — the BCP-47 locale identifiers this
// app's Intl/toLocaleString call sites use for date/number formatting.
export function languageCodeToLocale(code: "de" | "en"): "de-DE" | "en-US" {
  return code === "de" ? "de-DE" : "en-US";
}

// Display name for the language picker itself. Deliberately NOT run
// through the current app language (same reasoning as
// AppLanguage.swift's displayName): a user who picked the wrong language
// by accident must always be able to recognize their target language's
// entry, spelled in that language, regardless of what's currently active.
export function languageDisplayName(language: AppLanguage): string {
  switch (language) {
    case "system":
      return "Automatisch (Systemsprache)";
    case "de":
      return "Deutsch";
    case "en":
      return "English";
  }
}

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "system" || value === "de" || value === "en";
}
